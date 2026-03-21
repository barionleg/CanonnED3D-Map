const IDA_REPAIRS_URL = 'https://storage.googleapis.com/canonn-downloads/ida_repairs.json';
const IDA_COLONISATION_URL = 'https://storage.googleapis.com/canonn-downloads/ida_colonisation.json';

var canonnEd3d_ida = {

	systemsData: {
		categories: {
			'Operation Ida': {
				'301': {
					name: 'Repairs',
					color: 'FF6B35',
				},
				'302': {
					name: 'Colonisation',
					color: '00CED1',
				}
			},
			'Operation Ida Faction': {
				'401': {
					name: 'Controlled',
					color: '4AA02C', // green
				},
				'402': {
					name: 'Present',
					color: 'A8EB6A', // light green
				}
			}
		},
		systems: [],
		routes: [],
	},

	init: function () {
		Promise.all([
			fetch(IDA_REPAIRS_URL).then(function (response) { return response.json(); }),
			fetch(IDA_COLONISATION_URL).then(function (response) { return response.json(); }),
			fetch('https://downloads.spansh.co.uk/factions.json.gz')
		])
			.then(async function (results) {
				var repairs = results[0];
				var colonisations = results[1];
				// Decompress and parse the Spansh factions dump
				let factionsData;
				try {
					const response = results[2];
					const ds = new DecompressionStream('gzip');
					const decompressed = response.body.pipeThrough(ds);
					const reader = decompressed.getReader();
					let chunks = [];
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						chunks.push(value);
					}
					const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
					const combined = new Uint8Array(totalLength);
					let offset = 0;
					for (const chunk of chunks) {
						combined.set(chunk, offset);
						offset += chunk.length;
					}
					factionsData = JSON.parse(new TextDecoder().decode(combined));
				} catch (e) {
					console.error('Failed to load or parse Spansh factions.json.gz:', e);
					factionsData = [];
				}

				// Group repairs by station+system so multiple repairs to the same station
				// are combined into a single map point.
				var repairGroups = {};
				for (var i = 0; i < repairs.length; i++) {
					var entry = repairs[i];
					var station = entry['Station'];
					var system = entry['System'];
					var key = station + '||' + system;

					if (!repairGroups[key]) {
						repairGroups[key] = {
							station: station,
							system: system,
							area: entry['Area'],
							x: parseFloat(entry['x']),
							y: parseFloat(entry['y']),
							z: parseFloat(entry['z']),
							entries: []
						};
					}

					repairGroups[key].entries.push({
						tonsNeeded: entry['Overall Tons Needed'],
						completed: entry['Completed (YYYY-MM-DD)'],
						comments: entry['Comments']
					});
				}

				var repairKeys = Object.keys(repairGroups);
				for (var k = 0; k < repairKeys.length; k++) {
					var group = repairGroups[repairKeys[k]];
					var displayName = group.station + ' (' + group.system + ')';

					var entryParts = [];
					for (var e = 0; e < group.entries.length; e++) {
						var rep = group.entries[e];
						var part = 'Tons Needed: ' + (rep.tonsNeeded || 'N/A') + '<br>'
							+ 'Completed: ' + (rep.completed || 'N/A');
						if (rep.comments) {
							part += '<br>Notes: ' + rep.comments;
						}
						entryParts.push(part);
					}

					var infos = '<b>' + group.station + '</b><br>'
						+ 'System: ' + group.system + '<br>'
						+ 'Area: ' + (group.area || 'Unknown') + '<br><hr>'
						+ entryParts.join('<br><hr>');

					canonnEd3d_ida.systemsData.systems.push({
						name: displayName,
						cat: [301],
						coords: {
							x: group.x,
							y: group.y,
							z: group.z,
						},
						infos: infos,
					});
				}

				for (var j = 0; j < colonisations.length; j++) {
					var col = colonisations[j];
					var colSystem = col['System'];
					var stationType = col['Station Type'];
					var layoutType = col['Layout Type'];
					var startDate = col['Start Date'];
					var endDate = col['End Date'];

					var colInfos = '<b>' + colSystem + '</b><br>'
						+ 'Station Type: ' + (stationType || 'Unknown') + '<br>'
						+ 'Layout Type: ' + (layoutType || 'Unknown') + '<br>'
						+ 'Start Date: ' + (startDate || 'N/A') + '<br>'
						+ 'End Date: ' + (endDate || 'N/A');

					canonnEd3d_ida.systemsData.systems.push({
						name: colSystem,
						cat: [302],
						coords: {
							x: parseFloat(col['x']),
							y: parseFloat(col['y']),
							z: parseFloat(col['z']),
						},
						infos: colInfos,
					});
				}

				// Add Operation Ida faction systems from Spansh dump
				if (Array.isArray(factionsData)) {
					const idaFaction = factionsData.find(f => f.name && f.name.toLowerCase() === 'operation ida');
					if (idaFaction && Array.isArray(idaFaction.systems)) {
						idaFaction.systems.forEach(function (sys) {
							const isControlled = sys.isControllingFaction === true;
							canonnEd3d_ida.systemsData.systems.push({
								name: sys.systemName,
								cat: [isControlled ? 401 : 402],
								coords: {
									x: sys.coords.x,
									y: sys.coords.y,
									z: sys.coords.z
								},
								infos: '<b>Operation Ida Faction</b><br>' + (isControlled ? 'Controlled' : 'Present'),
							});
						});
					}
				}

				Ed3d.init({
					container: 'edmap',
					json: canonnEd3d_ida.systemsData,
					withFullscreenToggle: false,
					withHudPanel: true,
					hudMultipleSelect: true,
					effectScaleSystem: [20, 500],
					startAnim: false,
					showGalaxyInfos: true,
					cameraPos: [25, 14100, -12900],
					systemColor: '#FF9D00',
					finished: function () {
						// Ensure we start from a high-level (far) view, then animate in to Sol
						try {
							if (typeof camera !== 'undefined' && camera.position) {
								camera.position.set(25, 14100, -12900);
							}
							if (typeof controls !== 'undefined' && controls.target) {
								controls.target.set(0, 0, 0);
							}
						} catch (e) { /* ignore if globals not available yet */ }

						Ed3d.playerPos = [0, 0, 0];
						Ed3d.cameraPos = [0, 1000, -1500];
						if (Ed3d.Action && typeof Ed3d.Action.moveInitalPosition === 'function') {
							Ed3d.Action.moveInitalPosition(1500);
						}
					},
				});

				document.getElementById('loading').style.display = 'none';
			})
			.catch(function (err) {
				console.error('Failed to load Operation Ida data:', err);
			});
	}
};

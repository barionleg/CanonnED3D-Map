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
		// Render the map immediately with empty data
		Ed3d.init({
			container: 'edmap',
			json: canonnEd3d_ida.systemsData,
			withFullscreenToggle: false,
			withHudPanel: true,
			hudMultipleSelect: true,
			effectScaleSystem: [100, 10],
			startAnim: false,
			showGalaxyInfos: true,
			cameraPos: [0, 600, -1200],
			systemColor: '#FF9D00',
		});
		document.getElementById('loading').style.display = 'none';

		// Repairs
		fetch(IDA_REPAIRS_URL)
			.then(response => response.json())
			.then(repairs => {
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
				var batch = [];
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
					batch.push({
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
				Ed3d.addBatch({systems: batch});
				if (typeof HUD !== 'undefined' && HUD.initFilters) {
					HUD.initFilters(canonnEd3d_ida.systemsData.categories);
				}
			});

		// Colonisation
		fetch(IDA_COLONISATION_URL)
			.then(response => response.json())
			.then(colonisations => {
				var batch = [];
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
					batch.push({
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
				Ed3d.addBatch({systems: batch});
				if (typeof HUD !== 'undefined' && HUD.initFilters) {
					HUD.initFilters(canonnEd3d_ida.systemsData.categories);
				}
			});

		// Faction systems
		fetch('https://downloads.spansh.co.uk/factions.json.gz')
			.then(response => {
				const ds = new DecompressionStream('gzip');
				const decompressed = response.body.pipeThrough(ds);
				const reader = decompressed.getReader();
				let chunks = [];
				function pump() {
					return reader.read().then(({done, value}) => {
						if (done) return;
						chunks.push(value);
						return pump();
					});
				}
				return pump().then(() => {
					const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
					const combined = new Uint8Array(totalLength);
					let offset = 0;
					for (const chunk of chunks) {
						combined.set(chunk, offset);
						offset += chunk.length;
					}
					return JSON.parse(new TextDecoder().decode(combined));
				});
			})
			.then(factionsData => {
				if (Array.isArray(factionsData)) {
					const idaFaction = factionsData.find(f => f.name && f.name.toLowerCase() === 'operation ida');
					if (idaFaction && Array.isArray(idaFaction.systems)) {
						var batch = [];
						idaFaction.systems.forEach(function (sys) {
							const isControlled = sys.isControllingFaction === true;
							batch.push({
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
						Ed3d.addBatch({systems: batch});
						if (typeof HUD !== 'undefined' && HUD.initFilters) {
							HUD.initFilters(canonnEd3d_ida.systemsData.categories);
						}
					}
				}
			})
			.catch(function (err) {
				console.error('Failed to load Operation Ida data:', err);
			});
	}
};

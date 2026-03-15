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
			}
		},
		systems: [],
		routes: [],
	},

	init: function () {
		Promise.all([
			fetch(IDA_REPAIRS_URL).then(function (response) { return response.json(); }),
			fetch(IDA_COLONISATION_URL).then(function (response) { return response.json(); })
		])
			.then(function (results) {
				var repairs = results[0];
				var colonisations = results[1];

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

				Ed3d.init({
					container: 'edmap',
					json: canonnEd3d_ida.systemsData,
					withFullscreenToggle: false,
					withHudPanel: true,
					hudMultipleSelect: true,
					effectScaleSystem: [20, 500],
					startAnim: false,
					showGalaxyInfos: true,
					cameraPos: [0, 250, -500],
					systemColor: '#FF9D00',
				});

				document.getElementById('loading').style.display = 'none';
			})
			.catch(function (err) {
				console.error('Failed to load Operation Ida data:', err);
			});
	}
};

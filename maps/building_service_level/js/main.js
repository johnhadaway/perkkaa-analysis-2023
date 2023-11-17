const mapConfig = {
    centerCoordinates: [24.826367, 60.214861],
    zoomLevels: { min: 12, default: 15.5, max: 17 },
    extentCoordinates: [24.259512, 59.903851, 25.454228, 60.450752],
    styleUrl: './data/dark_matter.json'
};

let map, buildingsLayer;
const tooltipElement = document.getElementById('tooltip');

document.addEventListener('DOMContentLoaded', function () {
    map = initializeMap(mapConfig);
    map.on('load', function () {
        buildingsLayer = createBuildingsLayer(mapConfig);
        
        map.on('click', handleMapClick);
        map.on('mousemove', showTooltipOnHover);
    });
});

// fn. to initialize the map
function initializeMap(config) {
    const map = new maplibregl.Map({
        container: 'map',
        style: config.styleUrl,
        center: config.centerCoordinates,
        zoom: config.zoomLevels.default,
        minZoom: config.zoomLevels.min,
        maxZoom: config.zoomLevels.max,
        pitch: 45, 
        bearing: -30,
        maxBounds: [
            [24.781583, 60.165923],
            [24.909075, 60.232232]
        ]
    });

    map.on('load', () => {
        const bounds = [
            [24.781583, 60.165923],
            [24.909075, 60.232232]
        ];

        const worldBounds = [[-180, -90], [180, 90]];
        
        const dimmedAreaFeature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [[
                    worldBounds[0],
                    [worldBounds[0][0], worldBounds[1][1]],
                    worldBounds[1],
                    [worldBounds[1][0], worldBounds[0][1]],
                    worldBounds[0],
                    [bounds[0][0], worldBounds[0][1]],
                    bounds[0],
                    [bounds[1][0], bounds[0][1]],
                    bounds[1],
                    [bounds[0][0], bounds[1][1]],
                    [bounds[0][0], worldBounds[0][1]],
                    worldBounds[0]
                ]]
            }
        };

        map.addLayer({
            'id': 'dim-overlay',
            'type': 'fill',
            'source': {
                'type': 'geojson',
                'data': {
                    'type': 'FeatureCollection',
                    'features': [dimmedAreaFeature]
                }
            },
            'layout': {},
            'paint': {
                'fill-color': '#000',
                'fill-opacity': 1
            }
        });
    });

    return map;
}

// fn. to create the buildings layer
function createBuildingsLayer(config) {
    map.addSource('buildings', {
        type: 'geojson',
        data: './data/bay-buildings-joined-16-11-2023-elaborated.geojson'
    });

    map.addLayer({
        id: 'buildings3d',
        type: 'fill-extrusion',
        source: 'buildings',
        paint: {
            'fill-extrusion-height': ['get', 'assumed_height_based_on_floors'],
            'fill-extrusion-base': 0,
            'fill-extrusion-color': '#fff'
        }
    });
}

// fn. to handle map click events
function handleMapClick(event) {
    const features = map.queryRenderedFeatures(event.point, { layers: ['buildings3d'] });
}

// fn. to show tooltip on hover
function showTooltipOnHover(event) {
    const features = map.queryRenderedFeatures(event.point, { layers: ['buildings3d'] });
    if (features.length) {
        const feature = features[0];

        const tooltipContent = `
            <strong>Completion date:</strong> ${feature.properties.completion_date}<br>
            <strong>Purpose of use:</strong> ${feature.properties.purpose_of_use}<br>
            <strong>Purpose of use group:</strong> ${feature.properties.grouped_purpose_of_use}<br>
            <strong>Total dwellings</strong> ${feature.properties.number_of_dwellings}<br>
            <strong>Floor area per dwelling</strong> ${feature.properties.floor_area_per_dwelling}<br>
            <strong>Building height (assumed):</strong> ${feature.properties.assumed_height_based_on_floors}<br>
            <strong>Total places within 500m:</strong> ${feature.properties.places_within_500m}<br>
            <strong>Social places within 500m:</strong> ${feature.properties.social_places_within_500m}<br>
            <strong>Optional places within 500m:</strong> ${feature.properties.optional_places_within_500m}<br>
            <strong>Necessary places within 500m:</strong> ${feature.properties.necessary_places_within_500m}<br>
            <strong>Diversity of places within 500m:</strong> ${feature.properties.simpson_diversity_within_500m}
        `;

        tooltipElement.innerHTML = tooltipContent;
        tooltipElement.style.display = 'block';
        tooltipElement.style.left = event.point.x + 'px';
        tooltipElement.style.top = event.point.y + 'px';
    } else {
        tooltipElement.style.display = 'none';
    }
}

document.getElementById('apply-filters').addEventListener('click', function() {
    const purpose = document.getElementById('purpose-select').value;
    const heightProperty = document.getElementById('height-select').value;

    filterBuildingsByPurpose(purpose);
    applyNormalization(heightProperty);
});

// fn. to filter buildings by purpose
function filterBuildingsByPurpose(purpose) {
    if (purpose === 'all') {
        map.setFilter('buildings3d', null);
    } else {
        map.setFilter('buildings3d', ['==', ['get', 'grouped_purpose_of_use'], purpose]);
    }
}

// fn. for normalisation
function applyNormalization(property) {
    maxHeight = 300;
    fetch('./data/bay-buildings-joined-16-11-2023-elaborated.geojson')
        .then(response => response.json())
        .then(geojsonData => {
            const features = geojsonData.features;
            const values = features.map(feature => feature.properties[property])
                                   .filter(value => value != null && !isNaN(value));

            if (property.includes('simpson_diversity_within_') || property === 'days_since_earliest') {
                setBuildingHeightsPercentile(property, features, maxHeight);
            } else if (property === 'assumed_height_based_on_floors') {
                setBuildingHeightsDirect(property);
            } else if (property == 'floor_area_per_dwelling') {
                setBuildingHeightsLogScale(property, features, maxHeight);
            } else {
                setBuildingHeightsLinear(property, features, maxHeight);
            }
        });
}

// fn. for setting height directly without normalization
function setBuildingHeightsDirect(property) {
    map.setPaintProperty('buildings3d', 'fill-extrusion-height', [
        'case',
        ['!=', ['get', property], null],
        ['to-number', ['get', property]],
        0
    ]);
}

// fn. for setting building height in log scale
function setBuildingHeightsLogScale(property, features, maxHeight) {
    const propertyValues = features
        .map(feature => feature.properties[property])
        .filter(value => value !== null && value !== undefined && !isNaN(value) && value > 0);

    if (propertyValues.length === 0) {
        console.error(`No valid positive values found for property: ${property}`);
        return;
    }

    const minDataValue = Math.min(...propertyValues);
    const maxDataValue = Math.max(...propertyValues);

    if (minDataValue <= 0) {
        console.error(`Invalid minDataValue for logarithmic scale: ${minDataValue}`);
        return;
    }

    const stops = [
        Math.log(minDataValue), 0,
        Math.log(maxDataValue), maxHeight
    ];

    const safeStops = stops.filter(stop => typeof stop === 'number' && !isNaN(stop));
    if (safeStops.length !== stops.length) {
        console.error('Some stops are not numbers:', stops);
        return;
    }

    map.setPaintProperty('buildings3d', 'fill-extrusion-height', [
        'case',
        ['all', ['!=', ['get', property], null], ['>', ['get', property], 0]],
        ['interpolate', ['linear'], ['ln', ['+', ['get', property], 1]], ...safeStops],
        0
    ]);
}

// fn. for setting building heights in percentile
function setBuildingHeightsPercentile(property, features, maxHeight) {
    const values = features
        .filter(feature => feature.properties && feature.properties[property] !== undefined)
        .map(feature => feature.properties[property])
        .filter(value => value != null && !isNaN(value))
        .sort((a, b) => a - b);

    if (values.length === 0) {
        console.error(`No valid values found for property: ${property}`);
        return;
    }

    const uniqueValues = [...new Set(values)];
    const stops = uniqueValues.map((value, index, array) => {
        const height = (index / (array.length - 1)) * maxHeight;
        return [value, height];
    }).flat();

    map.setPaintProperty('buildings3d', 'fill-extrusion-height', [
        'case',
        ['!=', ['get', property], null],
        ['interpolate', ['linear'], ['get', property], ...stops],
        0
    ]);
}

// fn. to linearly normalise and set
function setBuildingHeightsLinear(property, features, maxHeight) {
    const propertyValues = features
        .map(feature => feature.properties[property])
        .filter(value => value !== null && value !== undefined && !isNaN(value));

    if (propertyValues.length === 0) {
        console.error(`No valid values found for property: ${property}`);
        return;
    }

    const minDataValue = Math.min(...propertyValues);
    const maxDataValue = Math.max(...propertyValues);

    map.setPaintProperty('buildings3d', 'fill-extrusion-height', [
        'case',
        ['!=', ['get', property], null],
        ['interpolate', ['linear'], ['get', property], minDataValue, 0, maxDataValue, maxHeight],
        0
    ]);
}
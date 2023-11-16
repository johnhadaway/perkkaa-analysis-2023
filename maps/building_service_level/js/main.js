maplibregl.accessToken = 'YOUR_ACCESS_TOKEN';

var map = new maplibregl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10', 
    center: [24.826367, 60.214861],
    zoom: 15.5
});

map.on('load', function () {
    map.addSource('buildings', {
        'type': 'vector',
        'url': 'YOUR_MBTILES_SOURCE_URL'
    });

    map.addLayer({
        'id': 'buildings',
        'type': 'fill-extrusion',
        'source': 'buildings',
        'source-layer': 'YOUR_LAYER_NAME',
        'paint': {
            'fill-extrusion-height': ['get', 'number_of_floors'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.6
        }
    });

    function updateBuildingHeights(metric) {
        map.setPaintProperty('buildings', 'fill-extrusion-height', ['get', metric]);
    }

    // Add UI controls and event listeners for toggling metrics
    // Example: document.getElementById('your-toggle-button').addEventListener(...)
});
const mapConfig = {
    centerCoordinates: [24.826367, 60.214861],
    zoomLevels: { min: 13, default: 15.5, max: 17 },
    extentCoordinates: [24.259512, 59.903851, 25.454228, 60.450752],
    baseMapUrl: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    vectorDataUrl: './data/places-helsinki-2023-10-19-alpha-gehl-cat-min-60per-confidence.geojson'
};

let isochroneLayer, pointLayer, vectorSource;
const tooltipElement = document.getElementById('tooltip');
const map = initializeMap(mapConfig);

map.on('singleclick', handleMapClick);
map.on('pointermove', showTooltipOnHover);

// fns. related to map init and layer creation
function initializeMap(config) {
    const extent = ol.proj.transformExtent(config.extentCoordinates, 'EPSG:4326', 'EPSG:3857');
    const map = new ol.Map({
        target: 'map',
        view: new ol.View({
            center: ol.proj.fromLonLat(config.centerCoordinates),
            zoom: config.zoomLevels.default,
            minZoom: config.zoomLevels.min,
            maxZoom: config.zoomLevels.max,
            extent: extent
        })
    });

    olms.apply(map, './data/dark_matter.json', 'your-mapbox-access-token').then(function() {
        const vectorLayer = createVectorLayer(mapConfig.vectorDataUrl);
        map.addLayer(vectorLayer);
    }).catch(function(error) {
        console.error('Error applying Mapbox style:', error);
    });

    return map;
}

function createVectorLayer(dataUrl) {
    vectorSource = new ol.source.Vector({
        url: dataUrl,
        format: new ol.format.GeoJSON()
    });

    return new ol.layer.Vector({
        source: vectorSource,
        style: createStyle('rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.3)', 2)
    });
}

// event handler fns.
async function handleMapClick(evt) {
    const coordinate = ol.proj.toLonLat(evt.coordinate);
    const isochroneData = await getIsochrone(coordinate);
    displayIsochrone(isochroneData);
    displayClickedPoint(coordinate);
    updateBarChartWithIsochroneData(isochroneData);
}

function showTooltipOnHover(evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
        return feature;
    });

    if (feature) {
        const geometry = feature.getGeometry();
        if (geometry && geometry.getType() === 'Point') {
            const coordinates = geometry.getCoordinates();

            tooltipElement.style.display = 'block';
            tooltipElement.style.left = `${evt.pixel[0]}px`;
            tooltipElement.style.top = `${evt.pixel[1] - 15}px`;

            const commonName = feature.get('commonName') || 'N/A';
            const mainCategory = feature.get('mainCategory') || 'N/A';
            const gehlCategory = feature.get('GehlCategory') || 'N/A';
            const confidence = feature.get('confidence') || 'N/A';

            tooltipElement.innerHTML = `
                <strong>Common name:</strong> ${commonName}<br>
                <strong>Main category:</strong> ${mainCategory}<br>
                <strong>Gehl category:</strong> ${gehlCategory}<br>
                <strong>Confidence:</strong> ${confidence}
            `;
        } else {
            tooltipElement.style.display = 'none';
        }
    } else {
        tooltipElement.style.display = 'none';
    }
}


// isochrone and point display fns.
async function getIsochrone(coordinate) {
    const apiKey = '5b3ce3597851110001cf62487c52da6c8a3e4221be79f49e0f4997d8';
    const mode = document.getElementById('modeDropdown').value;
    const timeMinutes = document.getElementById('timeDropdown').value;
    const timeSeconds = timeMinutes * 60;
    const url = `https://api.openrouteservice.org/v2/isochrones/${mode}`;

    const body = {
        locations: [[coordinate[0], coordinate[1]]],
        range: [timeSeconds],
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const message = `An error occurred: ${response.statusText}`;
        window.alert(message);
        return;
    }

    const isochroneData = await response.json();
    return isochroneData;
}

function displayIsochrone(isochroneData) {
    if (isochroneLayer) {
        map.removeLayer(isochroneLayer);
    }

    var format = new ol.format.GeoJSON();
    var features = format.readFeatures(isochroneData, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
    });

    var source = new ol.source.Vector({
        features: features
    });

    isochroneLayer = new ol.layer.Vector({
        source: source,
        style: new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(255, 255, 255, 0.3)'
            }),
            stroke: new ol.style.Stroke({
                color: '#fff',
                width: 1
            })
        })
    });

    map.addLayer(isochroneLayer);
}

function displayClickedPoint(coordinate) {
    if (pointLayer) {
        map.removeLayer(pointLayer);
    }

    var pointFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(coordinate))
    });

    var pointSource = new ol.source.Vector({
        features: [pointFeature]
    });

    pointLayer = new ol.layer.Vector({
        source: pointSource,
        style: new ol.style.Style({
            image: new ol.style.Circle({
                radius: 4,
                fill: new ol.style.Fill({color: 'white'}),
                stroke: new ol.style.Stroke({color: 'black', width: 1})
            })
        })
    });

    map.addLayer(pointLayer);
}

// data processing and chart fns.
function getFeaturesWithinIsochrone(isochroneData) {
    var featuresWithin = [];
    var isochronePolygon = turf.polygon(isochroneData.features[0].geometry.coordinates);

    vectorSource.forEachFeature(function(feature) {
        var coord = ol.proj.transform(feature.getGeometry().getCoordinates(), 'EPSG:3857', 'EPSG:4326');
        var point = turf.point(coord);

        if (turf.booleanPointInPolygon(point, isochronePolygon)) {
            featuresWithin.push(feature.getProperties());
        }
    });

    return featuresWithin;
}

function aggregateData(features) {
    let gehlCategoryCounts = {};

    features.forEach(feature => {
        if (feature && feature.GehlCategory) {
            let gehlCategory = feature.GehlCategory;
            gehlCategoryCounts[gehlCategory] = (gehlCategoryCounts[gehlCategory] || 0) + 1;
        }
    });

    return { gehlCategoryCounts };
}

function createBarChart(data, elementId) {
    d3.select(elementId).select("svg").remove();

    const containerWidth = document.getElementById(elementId.substring(1)).clientWidth;
    const containerHeight = document.getElementById(elementId.substring(1)).clientHeight;

    const margin = {top: 20, right: 30, bottom: 20, left: 30};
    const minWidth = 100;
    const minHeight = 100;

    const width = (Math.max(minWidth, containerWidth - margin.left - margin.right))/2;
    const height = Math.max(minHeight, containerHeight - margin.top - margin.bottom);

    if (width <= 0 || height <= 0) {
        console.error("Chart dimensions are invalid", width, height);
        return;
    }

    const x = d3.scaleBand()
        .range([0, width])
        .padding(0.1)
        .domain(data.map(d => d.key));

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(data, d => d.value)]);

    const svg = d3.select(elementId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        svg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.key))
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.value))
        .attr("height", d => Math.max(0, height - y(d.value)))
        .attr("fill", "rgba(255, 255, 255, 0)")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
        .selectAll("text").attr("fill", "#fff");

    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .attr("fill", "#fff");
}

function updateBarChartWithIsochroneData(isochroneData) {
    const featuresWithinIsochrone = getFeaturesWithinIsochrone(isochroneData);
    const aggregatedData = aggregateData(featuresWithinIsochrone);
    const chartData = Object.entries(aggregatedData.gehlCategoryCounts).map(([key, value]) => ({ key, value }));
    createBarChart(chartData, '#barChart1');
}

// util fns.
function createStyle(fillColor, strokeColor, radius) {
    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: radius,
            fill: new ol.style.Fill({ color: fillColor }),
            stroke: new ol.style.Stroke({ color: strokeColor, width: 1 })
        })
    });
}
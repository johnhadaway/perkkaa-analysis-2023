var isochroneLayer;
var pointLayer; 

const tooltipElement = document.getElementById('tooltip');

var extent = ol.proj.transformExtent(
    [24.259512, 59.903851, 25.454228, 60.450752], 
    'EPSG:4326', 
    'EPSG:3857'
);

var view = new ol.View({
    center: ol.proj.fromLonLat([24.826367, 60.214861]), 
    zoom: 15.5,
    minZoom: 13,
    maxZoom: 17,
    extent: extent
});

var map = new ol.Map({
    target: 'map',
    layers: [
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
            })
        })
    ],
    view: view
});

var vectorSource = new ol.source.Vector({
    url: './data/places_helsinki_2023-10-19-alpha-gehl-cat-min60perConfidence.geojson',
    format: new ol.format.GeoJSON()
});

var vectorLayer = new ol.layer.Vector({
    source: vectorSource,
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 2,
            fill: new ol.style.Fill({color: 'rgba(255, 255, 255, 0.3)'}),
            stroke: new ol.style.Stroke({color: 'rgba(0, 0, 0, 0.3)', width: 1})
        })
    })
});

map.addLayer(vectorLayer);

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
                color: '#000000',
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
                fill: new ol.style.Fill({color: 'black'}),
                stroke: new ol.style.Stroke({color: 'white', width: 1})
            })
        })
    });

    map.addLayer(pointLayer);
}

function getFeaturesWithinIsochrone(isochroneData) {
    var featuresWithin = [];
    var isochronePolygon = turf.polygon(isochroneData.features[0].geometry.coordinates);

    console.log("Isochrone Polygon:", isochronePolygon);

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
    console.log("Data passed to chart:", data); // Debugging
    d3.select(elementId).select("svg").remove();

    const containerWidth = document.getElementById(elementId.substring(1)).clientWidth;
    const containerHeight = document.getElementById(elementId.substring(1)).clientHeight;
    console.log(document.getElementById(elementId.substring(1)))

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

map.on('singleclick', async function (evt) {
    var coordinate = ol.proj.toLonLat(evt.coordinate);
    var isochroneData = await getIsochrone(coordinate);
    displayIsochrone(isochroneData);
    displayClickedPoint(coordinate);

    var featuresWithinIsochrone = getFeaturesWithinIsochrone(isochroneData);
    let aggregatedData = aggregateData(featuresWithinIsochrone);

    d3.select('#barChart1').html("");
    createBarChart(Object.entries(aggregatedData.gehlCategoryCounts).map(([key, value]) => ({key, value})), '#barChart1');
});

map.on('pointermove', function(evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
        return feature;
    });

    if (feature) {
        const coordinates = feature.getGeometry().getCoordinates();
        tooltipElement.style.display = 'block';
        tooltipElement.style.left = evt.pixel[0] + 'px';
        tooltipElement.style.top = evt.pixel[1] - 15 + 'px';

        const commonName = feature.get('commonName') || 'N/A';
        const mainCategory = feature.get('mainCategory') || 'N/A';
        const gehlCategory = feature.get('GehlCategory') || 'N/A';
        const confidence = feature.get('confidence') || 'N/A';

        tooltipElement.innerHTML = `
            <strong>Common Name:</strong> ${commonName}<br>
            <strong>Main Category:</strong> ${mainCategory}<br>
            <strong>Gehl Category:</strong> ${gehlCategory}<br>
            <strong>Confidence:</strong> ${confidence}
        `;
    } else {
        tooltipElement.style.display = 'none';
    }
});
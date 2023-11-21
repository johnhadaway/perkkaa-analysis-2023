const mapConfig = {
    centerCoordinates: [24.826367, 60.214861],
    zoomLevels: { min: 10, default: 14.5, max: 17 },
    styleUrl: './data/style.json'
};

let map;
const tooltipElement = document.getElementById('tooltip');
const yearLabel = document.getElementById('yearLabel');

// fn. to initialize the map
function initializeMap(config) {
    const map = new maplibregl.Map({
        container: 'map',
        style: config.styleUrl,
        center: config.centerCoordinates,
        zoom: config.zoomLevels.default,
        minZoom: config.zoomLevels.min,
        maxZoom: config.zoomLevels.max,
        pitch: 0,
        bearing: 0,
        pitchWithRotate: false,
        maxBounds: [
            [24.439912, 60.106414],
            [24.959423, 60.543638]
        ]
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    return map;
}

// fn. to create the car traffic volume layer
function createTrafficLayer() {
    map.addSource('trafficCounts', {
        type: 'geojson',
        data: './data/espoo-autoliikennemaarat-21-11-2023-min.geojson'
    });

    map.addLayer({
        id: 'trafficLayer',
        type: 'line',
        source: 'trafficCounts',
        layout: {},
        paint: {
            'line-width': 2,
            'line-color': '#FE4A49',
            'line-opacity': 0.8
        }
    });

    // fn. to to update the line chart when the user clicks on a road
    map.on('click', 'trafficLayer', function(e) {
        if (e.features.length > 0) {
            const feature = e.features[0];
            const trafficData = [
                { year: 2018, value: feature.properties['traffic_amount_2018'] },
                { year: 2019, value: feature.properties['traffic_amount_2019'] },
                { year: 2020, value: feature.properties['traffic_amount_2020'] },
                { year: 2021, value: feature.properties['traffic_amount_2021'] },
                { year: 2022, value: feature.properties['traffic_amount_2022'] },
            ];
            renderLineChart(trafficData);
        }
    });
}

// fn. to show tooltip on hover
function showTooltipOnHover(event) {
    const features = map.queryRenderedFeatures(event.point, { layers: ['trafficLayer'] });
    if (features.length) {
        const feature = features[0];
        const selectedYear = document.getElementById('yearSlider').value;
        const trafficAmount = feature.properties['traffic_amount_' + selectedYear];
        let perNightTraffic = feature.properties['per_night_traffic'];
        let perEveningRushHourTraffic = feature.properties['per_evening_rush_hour_traffic'];
        let perMorningRushHourTraffic = feature.properties['per_morning_rush_hour_traffic'];

        let tooltipContent = `
            <strong>Road:</strong> ${feature.properties.name}<br>
            <strong>Traffic ${selectedYear}:</strong> ${trafficAmount}
        `;

        if (selectedYear == '2022') {
            tooltipContent += perNightTraffic ? `<br><strong>Percentage night traffic:</strong> ${perNightTraffic}%` : '';
            tooltipContent += perEveningRushHourTraffic ? `<br><strong>Percentage evening rush hour traffic:</strong> ${perEveningRushHourTraffic}%` : '';
            tooltipContent += perMorningRushHourTraffic ? `<br><strong>Percentage morning rush hour traffic:</strong> ${perMorningRushHourTraffic}%` : '';
        }

        tooltipElement.innerHTML = tooltipContent;
        tooltipElement.style.display = 'block';
        tooltipElement.style.left = `${event.point.x}px`;
        tooltipElement.style.top = `${event.point.y}px`;
    } else {
        tooltipElement.style.display = 'none';
    }
}

// fn. to update the traffic visualization
function updateTrafficVisualization(selectedYear) {
    yearLabel.textContent = selectedYear;
    const property = 'traffic_amount_' + selectedYear;

    const maxTrafficAmount = 15000;

    map.setPaintProperty('trafficLayer', 'line-opacity', [
        'interpolate',
        ['linear'],
        ['get', property],
        0, 0,
        maxTrafficAmount, 1
    ]);
}

// fn. to render the line chart
function renderLineChart(data) {
    const container = d3.select('#line-chart');
    
    container.selectAll('svg').remove();

    const containerRect = container.node().getBoundingClientRect();
    const margin = { top: 10, right: 20, bottom: 20, left: 50 };
    const width = containerRect.width - margin.left - margin.right;
    const height = containerRect.height - margin.top - margin.bottom;

    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint()
        .range([0, width])
        .domain(data.map(d => d.year));

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(data, d => d.value)]);

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append('g')
        .call(d3.axisLeft(y).ticks(5));

    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#FE4A49')
        .attr('stroke-width', 2)
        .attr('d', d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value))
        );

    svg.selectAll('.dot')
        .data(data)
        .enter().append('circle')
        .attr('class', 'dot')
        .attr('cx', d => x(d.year))
        .attr('cy', d => y(d.value))
        .attr('r', 4)
        .attr('fill', '#FE4A49');
}

// fn. to update the traffic visualization when the slider changes
document.addEventListener('DOMContentLoaded', function () {
    map = initializeMap(mapConfig);
    map.on('load', function () {
        createTrafficLayer();
        map.on('mousemove', showTooltipOnHover);
        updateTrafficVisualization(document.getElementById('yearSlider').value);
    });
});
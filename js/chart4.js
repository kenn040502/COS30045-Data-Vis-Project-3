// =====================================
// CHART 2 — Radar + Choropleth by Location
// =====================================

function drawChart2(data, geoData) {

    // Build list of locations
    const locations = Array.from(
        new Set(
            data
                .map(d => (d.location || "").trim())
                .filter(loc => loc && loc.toLowerCase() !== "all regions")
        )
    ).sort();

    const uniqueLocations = ["Overview", ...locations];

    const dropdown = document.getElementById("locationSelect");
    dropdown.innerHTML = uniqueLocations
        .map(loc => `<option value="${loc}">${loc}</option>`)
        .join("");

    const mapUpdater = createLocationMap(data, geoData, "#chart2-map");
    createRadar(data, "#chart2-radar");

    // Initial map load
    if (uniqueLocations.length) mapUpdater(uniqueLocations[0]);

    dropdown.addEventListener("change", () => {
        const val = dropdown.value;

        const mapBox = document.querySelector("#chart2-map");

        if (mapBox) {
            if (!mapBox.style.transition) {
                mapBox.style.transition = "opacity 260ms ease";
            }
            if (mapBox.style.opacity === "" || mapBox.style.opacity == null) {
                mapBox.style.opacity = 1;
            }

            const onFadeOut = (e) => {
                if (e.propertyName !== "opacity") return;
                mapBox.removeEventListener("transitionend", onFadeOut);

                mapUpdater(val);

                requestAnimationFrame(() =>
                    requestAnimationFrame(() => {
                        mapBox.style.opacity = 1;
                    })
                );
            };

            mapBox.addEventListener("transitionend", onFadeOut);
            mapBox.style.display = "block";
            requestAnimationFrame(() => {
                mapBox.style.opacity = 0;
            });
        } else {
            mapUpdater(val);
        }

        highlightRadarPoint(val && val.toLowerCase() !== "overview" ? val : null);
    });
}



// =====================================
// RADAR CHART — compact + refined
// =====================================
function createRadar(allData, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    const bounds = container.node().getBoundingClientRect();
    const width = Math.max(360, bounds.width || 420);
    const height = Math.max(320, bounds.height || 360);
    const radius = Math.min(width, height) * 0.42;

    const svg = container
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("width", "100%")
        .attr("height", "100%");

    const g = svg
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2 + 10})`);

    const filtered = allData.filter(d => {
        const loc = (d.location || "").trim();
        return loc && loc.toLowerCase() !== "all regions";
    });

    const agg = filtered
        .map(d => {
            const totalTests = +d.totalTests || 0;
            const totalPos = +d.totalPositive || 0;
            const rate = totalTests ? (totalPos / totalTests) * 100 : 0;

            return {
                location: d.location,
                total: totalTests,
                positive: totalPos,
                rate: rate
            };
        })
        .sort((a, b) => d3.ascending(a.location, b.location));

    if (!agg.length) {
        g.append("text")
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .text("No data available");
        return;
    }

    const angle = d3.scaleBand()
        .domain(agg.map(d => d.location))
        .range([0, 2 * Math.PI]);

    const r = d3.scaleLinear()
        .domain([0, d3.max(agg, d => d.total)])
        .range([0, radius]);

    // Rings
    for (let i = 1; i <= 4; i++) {
        g.append("circle")
            .attr("r", (radius / 4) * i)
            .attr("fill", "none")
            .attr("stroke", "#ddd")
            .attr("stroke-dasharray", "4,2");
    }

    // Labels (moved 18 px away)
    g.selectAll(".radar-label")
        .data(agg)
        .enter()
        .append("text")
        .attr("class", "radar-label")
        .attr("x", d =>
            Math.sin(angle(d.location) + angle.bandwidth() / 2) * (radius + 18)
        )
        .attr("y", d =>
            -Math.cos(angle(d.location) + angle.bandwidth() / 2) * (radius + 18)
        )
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#333")
        .text(d => d.location);

    const radarLine = d3.lineRadial()
        .radius(d => r(d.total))
        .angle(d => angle(d.location) + angle.bandwidth() / 2)
        .curve(d3.curveCardinalClosed);

    g.append("path")
        .datum(agg)
        .attr("class", "radar-area")
        .attr("fill", "#4e79a7")
        .attr("fill-opacity", 0.15)
        .attr("stroke", "#4e79a7")
        .attr("stroke-width", 2)
        .attr("d", radarLine);

    g.selectAll(".radar-point")
        .data(agg)
        .enter()
        .append("circle")
        .attr("class", "radar-point")
        .attr("cx", d =>
            Math.sin(angle(d.location) + angle.bandwidth() / 2) * r(d.total)
        )
        .attr("cy", d =>
            -Math.cos(angle(d.location) + angle.bandwidth() / 2) * r(d.total)
        )
        .attr("r", 5)
        .attr("fill", "#4e79a7")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.2);

    // Tooltip
    const tooltip = container
        .append("div")
        .attr("class", "radar-tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #aaa")
        .style("padding", "6px 10px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0);

    g.selectAll(".radar-point")
        .on("mouseover", function (event, d) {
            tooltip.style("opacity", 1).html(`
                <strong>${d.location}</strong><br>
                Total Tests: ${d.total}<br>
                Positive Tests: ${d.positive}<br>
                Positive Rate: ${d.rate.toFixed(2)}%
            `);
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 20 + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));
}



// =====================================
// HIGHLIGHT RADAR POINT
// =====================================
function highlightRadarPoint(selectedLocation) {
    d3.selectAll(".radar-point")
        .transition()
        .duration(200)
        .attr("fill", d => d.location === selectedLocation ? "#ff6b35" : "#4e79a7")
        .attr("r", d => d.location === selectedLocation ? 10 : 5)
        .style("opacity", d =>
            selectedLocation ? (d.location === selectedLocation ? 1 : 0.25) : 1
        );

    d3.selectAll(".radar-label")
        .transition()
        .duration(200)
        .style("fill", d => d.location === selectedLocation ? "#ff6b35" : "#333")
        .style("font-weight", d => d.location === selectedLocation ? "bold" : "normal")
        .style("opacity", d =>
            selectedLocation ? (d.location === selectedLocation ? 1 : 0.25) : 1
        );

    d3.selectAll(".radar-area")
        .transition()
        .duration(200)
        .attr("fill-opacity", selectedLocation ? 0.05 : 0.15);
}



// =====================================
// MAP — compact + aligned
// =====================================
function createLocationMap(allData, geoData, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    const bounds = container.node().getBoundingClientRect();
    const width = Math.max(360, bounds.width || 420);
    const height = Math.max(320, bounds.height || 360);

    const svg = container
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("width", "100%")
        .attr("height", "100%");

    const projection = d3.geoMercator();
    try {
        projection.fitSize([width - 20, height - 20], geoData);
    } catch (e) {
        projection
            .center([134, -28])
            .scale(600)
            .translate([width / 2, height / 1.4]);
    }

    const path = d3.geoPath().projection(projection);

    // Tooltip
    const tooltip = container
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #333")
        .style("padding", "8px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.2)")
        .style("opacity", 0);

    const states = svg.selectAll("path.state")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("class", "state")
        .attr("d", path)
        .attr("fill", "#eee")
        .attr("stroke", "#333")
        .attr("stroke-width", 0.8)
        .style("cursor", "pointer");

    const stateLabels = svg.selectAll(".state-label")
        .data(geoData.features)
        .enter()
        .append("text")
        .attr("class", "state-label")
        .attr("transform", d => {
            const c = path.centroid(d) || [0, -3];
            return `translate(${c[0]}, ${c[1] + 4})`;
        })
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#222")
        .style("stroke", "#fff")
        .style("stroke-width", 0.1)
        .style("pointer-events", "none")
        .text(d => d.properties.STATE_NAME);

    // Map config
    const stateConfig = {
        "new south wales": { totalKey: "nswTotal", posKey: "nswPos" },
        "victoria": { totalKey: "vicTotal", posKey: "vicPos" },
        "queensland": { totalKey: "qldTotal", posKey: "qldPos" },
        "south australia": { totalKey: "saTotal", posKey: "saPos" },
        "western australia": { totalKey: "waTotal", posKey: "waPos" },
        "tasmania": { totalKey: "tasTotal", posKey: "tasPos" },
        "northern territory": { totalKey: "ntTotal", posKey: "ntPos" },
        "australian capital territory": { totalKey: "actTotal", posKey: "actPos" }
    };

    // Updater
    function update(location) {
        const isOverview = location.toLowerCase() === "overview";

        const rows = isOverview
            ? allData
            : allData.filter(d => d.location === location);

        const totals = new Map(Object.keys(stateConfig).map(s => [s, 0]));
        const positives = new Map(Object.keys(stateConfig).map(s => [s, 0]));

        rows.forEach(row => {
            Object.entries(stateConfig).forEach(([stateName, cfg]) => {
                const totalVal = +row[cfg.totalKey] || 0;
                const posVal = +row[cfg.posKey] || 0;

                totals.set(stateName, totals.get(stateName) + totalVal);
                positives.set(stateName, positives.get(stateName) + posVal);
            });
        });

        const allTotals = Array.from(totals.values());
        const maxValue = d3.max(allTotals) || 1;
        const grandTotal = d3.sum(allTotals) || 0;

        const color = d3.scaleLinear()
            .domain([0, maxValue])
            .range(["#e3f2fd", "#00176B"]);

        states.transition()
            .duration(500)
            .attr("fill", d => {
                const name = (d.properties.STATE_NAME || "").toLowerCase();
                const v = totals.get(name) || 0;
                if (v === 0) return "#2b2b2b";
                return color(v);
            })
            .attr("opacity", d => {
                if (isOverview) return 1;
                const name = d.properties.STATE_NAME.toLowerCase();
                const v = totals.get(name) || 0;
                return v > 0 ? 1 : 0.4;
            });

        // Tooltip
        states
            .on("mouseover", function (event, d) {
                const raw = d.properties.STATE_NAME;
                const name = raw.toLowerCase();

                const total = totals.get(name) || 0;
                const pos = positives.get(name) || 0;
                const rate = total ? (pos / total) * 100 : 0;
                const share = grandTotal ? (total / grandTotal) * 100 : 0;

                tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${raw}</strong><br>
                        Total Tests: ${total}<br>
                        Percentage of tests in ${location}: ${share.toFixed(2)}%<br>
                        Positive Tests: ${pos}<br>
                        Positive Rate: ${rate.toFixed(2)}%<br>
                    `);

                d3.select(this)
                    .transition()
                    .duration(120)
                    .attr("stroke-width", 2)
                    .attr("stroke", "#222");

                stateLabels.raise();
            })
            .on("mousemove", function (event) {
                tooltip
                    .style("left", event.pageX + 12 + "px")
                    .style("top", event.pageY - 20 + "px");
            })
            .on("mouseout", function () {
                tooltip.style("opacity", 0);
                d3.select(this)
                    .transition()
                    .duration(120)
                    .attr("stroke-width", 0.8)
                    .attr("stroke", "#333");
            });

        stateLabels.raise();
    }

    return update;
}

// =====================================
// MAIN ENTRY — Load from loadData.js
// =====================================
function drawChart2(data, geoData) {

    const parsed = data.map(d => ({
        jurisdiction: (d.jurisdiction || "").toLowerCase(),
        location: d.location,
        bestDetectionMethod: d.bestDetectionMethod?.toLowerCase() || "",
        count: +d.count || 0,
        year: +d.year
    }));

    // Get list of locations (exclude empty and 'All regions')
    const cleanedLocations = Array.from(
        new Set(
            parsed
                .map(d => (d.location || "").trim())
                .filter(loc => loc && loc.toLowerCase() !== "all regions")
        )
    ).sort();

    // 'Overview' option at the top
    const uniqueLocations = ["Overview", ...cleanedLocations.filter(l => l.toLowerCase() !== "overview")];

    const dropdown = document.getElementById("locationSelect");
    dropdown.innerHTML = uniqueLocations
        .map(loc => `<option value="${loc}">${loc}</option>`)
        .join("");

    const mapUpdater = createLocationMap(parsed, geoData, "#chart2-map");
    createRadar(parsed, "#chart2-radar");

    // Initial map: Overview (all data)
    const initial = uniqueLocations.length ? uniqueLocations[0] : null;
    if (initial) mapUpdater(initial);

    // When user selects from dropdown
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

                // Update the map while hidden
                mapUpdater(val);

                // Fade back in
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

        // Highlight radar point (Overview resets highlights)
        highlightRadarPoint(val && val.toLowerCase() !== "overview" ? val : null);
    });
}



// =====================================
// RADAR CHART (non-interactive overview)
// =====================================
function createRadar(allData, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    const width = 500;
    const height = 450;
    const radius = 180;

    const svg = container
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    // Filter out empty and "All regions"
    const filtered = allData.filter(d => {
        const loc = (d.location || "").trim();
        return loc && loc.toLowerCase() !== "all regions";
    });

    const agg = d3.rollups(
        filtered,
        v => ({
            total: d3.sum(v, d => d.count),
            positive: d3.sum(v.filter(d => d.bestDetectionMethod === "yes"), d => d.count)
        }),
        d => d.location
    )
        .map(([loc, stats]) => ({
            location: loc,
            total: stats.total,
            positive: stats.positive
        }))
        .sort((a, b) => d3.ascending(a.location, b.location));

    if (!agg.length) {
        g.append("text")
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .text("No data available");
        return;
    }

    const angle = d3
        .scaleBand()
        .domain(agg.map(d => d.location))
        .range([0, 2 * Math.PI]);

    const r = d3
        .scaleLinear()
        .domain([0, d3.max(agg, d => d.positive)])
        .range([0, radius]);

    // Background grid rings
    for (let i = 1; i <= 4; i++) {
        g.append("circle")
            .attr("r", (radius / 4) * i)
            .attr("fill", "none")
            .attr("stroke", "#ccc")
            .attr("stroke-dasharray", "5,3");
    }

    // Labels
    g.selectAll(".radar-label")
        .data(agg)
        .enter()
        .append("text")
        .attr("class", "radar-label")
        .attr("x", d => Math.sin(angle(d.location) + angle.bandwidth() / 2) * (radius + 20))
        .attr("y", d => -Math.cos(angle(d.location) + angle.bandwidth() / 2) * (radius + 20))
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#333")
        .text(d => d.location);

    // Radar area
    const radarLine = d3
        .lineRadial()
        .radius(d => r(d.positive))
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

    // Points
    g.selectAll(".radar-point")
        .data(agg)
        .enter()
        .append("circle")
        .attr("class", "radar-point")
        .attr("cx", d => Math.sin(angle(d.location) + angle.bandwidth() / 2) * r(d.positive))
        .attr("cy", d => -Math.cos(angle(d.location) + angle.bandwidth() / 2) * r(d.positive))
        .attr("r", 6)
        .attr("fill", "#4e79a7")
        .attr("stroke", "#fff");

    // Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Location Positive Detection Profile");
}



// =====================================
// HIGHLIGHT RADAR POINT FROM DROPDOWN
// =====================================
function highlightRadarPoint(selectedLocation) {
    d3.selectAll(".radar-point")
        .transition()
        .duration(200)
        .attr("fill", d => d.location === selectedLocation ? "#ff6b35" : "#4e79a7")
        .attr("r", d => d.location === selectedLocation ? 10 : 6)
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
// MAP WITH CHOROPLETH + SPOTLIGHT EFFECT
// =====================================
function createLocationMap(allData, geoData, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    const width = 500;
    const height = 450;

    const svg = container
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const defs = svg.append("defs");

    // Background
    svg.append("rect")
        .attr("x", -10)
        .attr("y", -10)
        .attr("width", width + 20)
        .attr("height", height + 20)
        .attr("fill", "#ffffff")
        .lower();

    // Projection fit to GeoJSON
    const projection = d3.geoMercator();
    try {
        projection.fitSize([width - 20, height - 20], geoData);
    } catch (e) {
        projection.center([134, -28]).scale(600).translate([width / 2, height / 1.4]);
    }

    const path = d3.geoPath().projection(projection);

    // Tooltip
    const tooltip = container
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(255,255,255,0.95)")
        .style("border", "2px solid #333")
        .style("border-radius", "6px")
        .style("padding", "10px 12px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.2)")
        .style("opacity", 0);

    // Base map
    const states = svg
        .selectAll("path.state")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("class", "state")
        .attr("d", path)
        .attr("fill", "#eee")
        .attr("stroke", "#555")
        .attr("stroke-width", 0.8)
        .style("cursor", "pointer");

    // Labels
    svg.selectAll(".state-label")
        .data(geoData.features)
        .enter()
        .append("text")
        .attr("class", "state-label")
        .attr("transform", d => {
            const c = path.centroid(d) || [0, 0];
            return `translate(${c[0]}, ${c[1] + 14})`;
        })
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#222")
        .style("stroke", "#fff")
        .style("stroke-width", 0.8)
        .style("paint-order", "stroke")
        .style("pointer-events", "none")
        .text(d => (d.properties.STATE_NAME || d.properties.name || "").toString());

    // Title
    const title = svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .style("font-weight", "bold");

    // Choropleth legend (created once, updated later)
    const legendWidth = 12;
    const legendHeight = 160;
    const legendX = width - legendWidth - 18;
    const legendY = 60;

    // Gradient for legend
    defs.select("#legendGrad")?.remove();
    const legendGradient = defs
        .append("linearGradient")
        .attr("id", "legendGrad")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");

    legendGradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#00176B");
    legendGradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#e3f2fd");

    svg.selectAll(".choropleth-legend").remove();
    const legend = svg
        .append("g")
        .attr("class", "choropleth-legend")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    legend
        .append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .attr("fill", "url(#legendGrad)")
        .attr("stroke", "#ccc");

    const legendMaxText = legend
        .append("text")
        .attr("x", legendWidth + 8)
        .attr("y", 8)
        .style("font-size", "11px");

    const legendMinText = legend
        .append("text")
        .attr("x", legendWidth + 8)
        .attr("y", legendHeight)
        .attr("dy", "0.35em")
        .style("font-size", "11px")
        .text("0");

    legend
        .append("text")
        .attr("x", legendWidth + 8)
        .attr("y", legendHeight + 18)
        .style("font-size", "11px")
        .text("Darker → More tests");

    function update(location) {
        // Overview = all data, otherwise filter by location
        const isOverview = location && location.toLowerCase() === "overview";
        const filtered = isOverview
            ? allData
            : allData.filter(d => d.location === location);

        // Normalize jurisdiction to match GeoJSON names
        const jurisdictionMap = {
            nsw: "new south wales",
            vic: "victoria",
            qld: "queensland",
            wa: "western australia",
            sa: "south australia",
            tas: "tasmania",
            nt: "northern territory",
            act: "australian capital territory"
        };

        const rawTotals = d3.rollup(
            filtered,
            v => d3.sum(v, d => d.count),
            d => (d.jurisdiction || "").toString().trim().toLowerCase()
        );

        const totals = new Map();
        for (const [key, val] of rawTotals.entries()) {
            const mapped = jurisdictionMap[key] || key;
            totals.set(mapped, (totals.get(mapped) || 0) + val);
        }

        const totalSum = d3.sum(Array.from(totals.values()));
        const maxValue = d3.max(Array.from(totals.values())) || 1;

        const color = d3
            .scaleLinear()
            .domain([0, maxValue])
            .range(["#e3f2fd", "#00176B"]);

        // Spotlight effect:
        // - Overview: all states full opacity, no scale
        // - Filtered: states with 0 tests → slightly smaller & faded
        states
            .transition()
            .duration(500)
            .attr("fill", d => {
                const name = (d.properties.STATE_NAME || d.properties.name).toLowerCase();
                const v = totals.get(name);
                return v ? color(v) : "#f0f0f0";
            })
            .attr("opacity", d => {
                if (isOverview) return 1;
                const name = (d.properties.STATE_NAME || d.properties.name).toLowerCase();
                const v = totals.get(name) || 0;
                return v > 0 ? 1 : 0.15;
            })
            .attr("transform", d => {
                const c = path.centroid(d) || [0, 0];
                if (isOverview) {
                    // no scaling in overview mode
                    return `translate(0,0)`;
                }
                const name = (d.properties.STATE_NAME || d.properties.name).toLowerCase();
                const v = totals.get(name) || 0;
                const scale = v > 0 ? 1 : 0.97; // shrink slightly if no data
                return `translate(${c[0]},${c[1]}) scale(${scale}) translate(${-c[0]},${-c[1]})`;
            })
            // --- APPLY LABEL VISUALS (fade + shrink if zero) ---
            svg.selectAll(".state-label")
                .transition()
                .duration(400)
                .attr("opacity", d => {
                    if (isOverview) return 1;
                    const name = (d.properties.STATE_NAME || d.properties.name).toLowerCase();
                    const v = totals.get(name) || 0;
                    return v > 0 ? 1 : 0.15;
                })
                .attr("transform", d => {
                    const base = path.centroid(d) || [0, 0];
                    if (isOverview) {
                        return `translate(${base[0]}, ${base[1] + 14})`;
                    }
                    const name = (d.properties.STATE_NAME || d.properties.name).toLowerCase();
                    const v = totals.get(name) || 0;
                    const scale = v > 0 ? 1 : 0.9;   // shrink faded labels slightly
                    return `
                        translate(${base[0]}, ${base[1] + 14})
                        scale(${scale})
                    `;
                })
                .style("font-weight", d => {
                    if (isOverview) return "600";      // default
                    const name = (d.properties.STATE_NAME || d.properties.name).toLowerCase();
                    return totals.get(name) > 0 ? "600" : "400";
                })
                .style("fill", d => {
                    if (isOverview) return "#222";
                    const name = (d.properties.STATE_NAME || d.properties.name).toLowerCase();
                    return totals.get(name) > 0 ? "#222" : "#aaaaaa";   // faded grey
                });


        // Keep labels on top
        svg.selectAll(".state-label").raise();

        // Update legend max label
        legendMaxText.text(`${Math.round(maxValue)}`);

        title.text(`Jurisdiction contribution — ${location}`);

        // State hover interaction
        states
            .on("mouseover", function (event, d) {
                const name = (d.properties.STATE_NAME || d.properties.name).toLowerCase();
                const v = totals.get(name) || 0;
                const pct = totalSum ? ((v / totalSum) * 100).toFixed(1) : "0.0";

                d3.select(this)
                    .raise()
                    .transition()
                    .duration(120)
                    .attr("stroke-width", 2)
                    .attr("stroke", "#222");

                svg.selectAll(".state-label").raise();

                if (v > 0) {
                    tooltip
                        .style("opacity", 1)
                        .html(
                            `<strong>${d.properties.STATE_NAME}</strong><br/>Tests: ${v}<br/>Share: ${pct}%`
                        );
                } else if (!isOverview) {
                    tooltip
                        .style("opacity", 1)
                        .html(
                            `<strong>${d.properties.STATE_NAME}</strong><br/>No tests for this location`
                        );
                }
            })
            .on("mousemove", function (event) {
                tooltip
                    .style("left", event.pageX + 15 + "px")
                    .style("top", event.pageY - 20 + "px");
            })
            .on("mouseout", function () {
                d3.select(this)
                    .transition()
                    .duration(120)
                    .attr("stroke-width", 0.8)
                    .attr("stroke", "#555");
                svg.selectAll(".state-label").raise();
                tooltip.style("opacity", 0);
            });
    }

    return update;
}

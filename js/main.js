// js/main.js
(async function () {
  // --------------------------------------------------
  // 1. LOAD CSV (required)
  // --------------------------------------------------
  let rows;
  try {
    // CSV is in the same folder as index.html
    rows = await d3.csv("cleanedData.csv");
  } catch (err) {
    console.error("CSV load error:", err);
    d3.select("body").append("div").text("Could not load cleanedData.csv");
    return;
  }

  // 1b. LOAD GEOJSON (optional - map will show message if missing)
  let aus = null;
  try {
    aus = await d3.json("australia_states.geojson");
  } catch (err) {
    console.warn("GeoJSON load error (maps will be disabled):", err);
  }

  // --------------------------------------------------
  // 2. NORMALISE COLUMN NAMES
  // --------------------------------------------------
  rows.forEach(d => {
    d.year = +(d.year || d.YEAR || 0);
    d.jurisdiction =
      d.jurisdiction || d.JURISDICTION || d.state || d.State || "";
    d.location = d.location || d.LOCATION || "";
    d.age_group = d.age_group || d.AGE_GROUP || "";
    // your screenshot shows "DETECTION" - handle both
    d.detection_method =
      d.detection_method ||
      d.DETECTION_METHOD ||
      d.DETECTION ||
      "";
    // COUNT holds number of positive tests in this grouped row
    d.positive_count = +(
      d.positive_count ||
      d.POSITIVE_COUNT ||
      d.count ||
      d.COUNT ||
      0
    );
  });

  // --------------------------------------------------
  // 3. UNIQUE LISTS FOR FILTERS
  // --------------------------------------------------
  const years = Array.from(new Set(rows.map(d => d.year)))
    .filter(Boolean)
    .sort((a, b) => b - a); // newest first

  const jurs = Array.from(new Set(rows.map(d => d.jurisdiction)))
    .filter(Boolean)
    .sort();

  // Drug columns present in CSV
  const allDrugColumns = ["AMPHETAMINE", "CANNABIS", "ECSTASY"];
  const drugs = allDrugColumns.slice(); // same labels as columns

  // Colour for "winning" drug on map
  const drugColorMap = {
    Amphetamine: "#f97316", // orange
    Cannabis: "#22c55e",    // green
    Ecstasy: "#6366f1"      // purple
  };

  // GLOBAL STATE
  const state = {
    data: rows,
    geo: aus,
    years: new Set([years[0]]), // start with latest year only
    jurisdictions: new Set(),   // empty = all
    drugs: new Set(),           // empty = all (means all 3 drugs)
    sort: "desc"
  };

  // --------------------------------------------------
  // 4. BUILD YEAR PILLS
  // --------------------------------------------------
  const yearPills = d3.select("#yearPills");
  years.forEach(y => {
    yearPills
      .append("button")
      .attr("class", `pill ${state.years.has(y) " "active" : ""}`)
      .attr("data-year", y)
      .text(y);
  });

  d3.selectAll("#yearPills .pill").on("click", function () {
    const y = +this.getAttribute("data-year");
    if (state.years.has(y)) {
      if (state.years.size > 1) state.years.delete(y); // keep at least 1
    } else {
      state.years.add(y);
    }

    d3.selectAll("#yearPills .pill").classed("active", function () {
      const yy = +this.getAttribute("data-year");
      return state.years.has(yy);
    });

    renderAll();
  });

  // --------------------------------------------------
  // 5. MULTI-SELECTS (JURISDICTION & DRUG TYPE)
  // --------------------------------------------------
  const jurSel = d3.select("#jurSelect");
  jurs.forEach(j => {
    jurSel.append("option").attr("value", j).text(j);
  });

  const drugSel = d3.select("#drugSelect");
  drugs.forEach(dr => {
    drugSel.append("option").attr("value", dr).text(dr);
  });

  function getSelectedValues(selectElem) {
    const opts = Array.from(selectElem.options);
    return opts.filter(o => o.selected).map(o => o.value);
  }

  jurSel.on("change", function () {
    const selected = getSelectedValues(this);
    state.jurisdictions = new Set(selected);
    renderAll();
  });

  drugSel.on("change", function () {
    const selected = getSelectedValues(this);
    state.drugs = new Set(selected); // e.g. ["CANNABIS"]
    renderAll();
  });

  const sortSel = d3.select("#sortSelect");
  sortSel.on("change", function () {
    state.sort = this.value;
    renderAll();
  });

  // RESET BUTTON
  d3.select("#resetBtn").on("click", () => {
    state.years = new Set([years[0]]);
    state.jurisdictions = new Set();
    state.drugs = new Set();
    state.sort = "desc";

    d3.selectAll("#yearPills .pill").classed("active", function () {
      const yy = +this.getAttribute("data-year");
      return yy === years[0];
    });
    Array.from(jurSel.node().options).forEach(o => (o.selected = false));
    Array.from(drugSel.node().options).forEach(o => (o.selected = false));
    sortSel.property("value", "desc");

    renderAll();
  });

  // --------------------------------------------------
  // 6. FILTER FUNCTION
  // --------------------------------------------------
  function getFilteredData() {
    return state.data.filter(d => {
      const yearOK = state.years.has(d.year);
      const jurOK =
        state.jurisdictions.size === 0 ||
        state.jurisdictions.has(d.jurisdiction);

      // if user selected specific drug types, keep only rows
      // where at least one of those drug columns is "Yes"
      let drugOK = true;
      if (state.drugs.size > 0) {
        drugOK = false;
        for (const drugCol of state.drugs) {
          const val = (d[drugCol] || d[drugCol.toLowerCase()] || "")
            .toString()
            .trim()
            .toLowerCase();
          if (val === "yes") {
            drugOK = true;
            break;
          }
        }
      }

      return yearOK && jurOK && drugOK;
    });
  }

  // --------------------------------------------------
  // 7. MAIN RENDER
  // --------------------------------------------------
  function renderAll() {
    const filtered = getFilteredData();
    renderDrugMap(filtered, state.geo);          // Q4: winning drug map
    renderMethodChart(filtered);                 // Q5
    renderJurisdictionMap(filtered, state.geo);  // Q3
  }

  // initial render
  renderAll();

  // --------------------------------------------------
  // 8. CHARTS
  // --------------------------------------------------

  // 8.1 Drug types detected as categorical map (Q4)
  function renderDrugMap(data, geo) {
    const container = d3.select("#ageChart");
    container.selectAll("*").remove();

    if (!geo || !geo.features) {
      container
        .append("div")
        .style("padding", "0.75rem")
        .style("font-size", "0.8rem")
        .text("Map data not available. Add australia_states.geojson to enable this map.");
      return;
    }

    const width = container.node().clientWidth || 400;
    const height = 260;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };

    // 1) aggregate totals per state per drug
    // stateTotals[jur] = { Amphetamine: x, Cannabis: y, Ecstasy: z }
    const stateTotals = new Map();

    data.forEach(d => {
      const jur = d.jurisdiction;
      if (!jur) return;

      let entry = stateTotals.get(jur);
      if (!entry) {
        entry = { Amphetamine: 0, Cannabis: 0, Ecstasy: 0 };
        stateTotals.set(jur, entry);
      }

      allDrugColumns.forEach(col => {
        const val = (d[col] || d[col.toLowerCase()] || "")
          .toString()
          .trim()
          .toLowerCase();

        if (val === "yes") {
          const pretty =
            col.charAt(0) + col.slice(1).toLowerCase(); // AMPHETAMINE -> Amphetamine
          entry[pretty] += d.positive_count;
        }
      });
    });

    // 2) for each state, pick the drug with the highest total
    const topByState = new Map(); // topByState[jur] = { drug, total }

    for (const [jur, totals] of stateTotals.entries()) {
      let bestDrug = null;
      let bestVal = 0;
      for (const [drug, val] of Object.entries(totals)) {
        if (val > bestVal) {
          bestVal = val;
          bestDrug = drug;
        }
      }
      if (bestDrug) {
        topByState.set(jur, { drug: bestDrug, total: bestVal });
      }
    }

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMinYMin meet")
      .attr("width", "100%")
      .attr("height", "100%");

    const projection = d3.geoMercator().fitSize(
      [width - margin.left - margin.right, height - margin.top - margin.bottom],
      geo
    );
    const path = d3.geoPath().projection(projection);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // 3) draw states coloured by winning drug
    g.selectAll("path")
      .data(geo.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .attr("fill", d => {
        // adjust property name if your GeoJSON uses something else
        const code =
          d.properties.STATE_ABBR ||
          d.properties.STATE_CODE ||
          d.properties.jurisdiction;

        const info = topByState.get(code);
        if (!info) return "#eeeeee"; // no data
        return drugColorMap[info.drug] || "#cccccc";
      })
      .append("title")
      .text(d => {
        const code =
          d.properties.STATE_ABBR ||
          d.properties.STATE_CODE ||
          d.properties.jurisdiction;
        const info = topByState.get(code);
        if (!info) return `${code}: no positives for these drugs`;
        return `${code}: ${info.drug} (${info.total.toLocaleString()} positives)`;
      });

    // 4) legend for 3 drug colours
    const legend = svg.append("g")
      .attr("transform", `translate(${width - 130},${20})`);

    const legendItems = ["Amphetamine", "Cannabis", "Ecstasy"];

    legend.selectAll("rect")
      .data(legendItems)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d, i) => i * 18)
      .attr("width", 12)
      .attr("height", 12)
      .attr("rx", 2)
      .attr("fill", d => drugColorMap[d] || "#ccc");

    legend.selectAll("text")
      .data(legendItems)
      .enter()
      .append("text")
      .attr("x", 18)
      .attr("y", (d, i) => i * 18 + 10)
      .text(d => d)
      .style("font-size", "10px");
  }

  // 8.2 Detection methods contribution (Q5)
  function renderMethodChart(data) {
    const container = d3.select("#methodChart");
    container.selectAll("*").remove();
    const width = container.node().clientWidth || 400;
    const height = 250;
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };

    const grouped = d3.rollups(
      data,
      v => d3.sum(v, d => d.positive_count),
      d => d.detection_method
    )
      .map(([detection_method, total]) => ({ detection_method, total }))
      .filter(d => d.detection_method);

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMinYMin meet")
      .attr("width", "100%")
      .attr("height", "100%");

    const x = d3.scaleBand()
      .domain(grouped.map(d => d.detection_method))
      .range([margin.left, width - margin.right])
      .padding(0.25);

    const y = d3.scaleLinear()
      .domain([0, d3.max(grouped, d => d.total) || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-20)")
      .style("text-anchor", "end")
      .style("font-size", "10px");

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5));

    svg.selectAll("rect")
      .data(grouped)
      .enter()
      .append("rect")
      .attr("x", d => x(d.detection_method))
      .attr("y", d => y(d.total))
      .attr("width", x.bandwidth())
      .attr("height", d => height - margin.bottom - y(d.total))
      .attr("fill", "#f38b4f")
      .append("title")
      .text(d => `${d.detection_method}: ${d.total.toLocaleString()}`);
  }

  // 8.3 Jurisdiction map (Q3)
  function renderJurisdictionMap(data, geo) {
    const container = d3.select("#locationChart");
    container.selectAll("*").remove();

    if (!geo || !geo.features) {
      container
        .append("div")
        .style("padding", "0.75rem")
        .style("font-size", "0.8rem")
        .text("Map data not available. Add australia_states.geojson to enable the choropleth map.");
      return;
    }

    const width = container.node().clientWidth || 700;
    const height = 350;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };

    const totalsArr = d3.rollups(
      data,
      v => d3.sum(v, d => d.positive_count),
      d => d.jurisdiction
    );
    const totals = new Map(totalsArr);
    const maxVal = d3.max(totalsArr, d => d[1]) || 1;

    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxVal]);

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMinYMin meet")
      .attr("width", "100%")
      .attr("height", "100%");

    const projection = d3.geoMercator().fitSize(
      [width - margin.left - margin.right, height - margin.top - margin.bottom],
      geo
    );
    const path = d3.geoPath().projection(projection);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g.selectAll("path")
      .data(geo.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .attr("fill", d => {
        const code =
          d.properties.STATE_ABBR ||
          d.properties.STATE_CODE ||
          d.properties.jurisdiction;
        const value = totals.get(code) || 0;
        return value > 0 " color(value) : "#eeeeee";
      })
      .append("title")
      .text(d => {
        const code =
          d.properties.STATE_ABBR ||
          d.properties.STATE_CODE ||
          d.properties.jurisdiction;
        const value = totals.get(code) || 0;
        return `${code}: ${value.toLocaleString()} positives`;
      });

    // legend
    const legendWidth = 140;
    const legendHeight = 10;
    const legendX = width - legendWidth - 40;
    const legendY = height - 30;

    const legend = svg.append("g")
      .attr("transform", `translate(${legendX},${legendY})`);

    const legendScale = d3.scaleLinear()
      .domain([0, maxVal])
      .range([0, legendWidth]);

    const gradId = "map-gradient";
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient")
      .attr("id", gradId);
    grad.append("stop").attr("offset", "0%").attr("stop-color", color(0));
    grad.append("stop").attr("offset", "100%").attr("stop-color", color(maxVal));

    legend.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", `url(#${gradId})`);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(3)
      .tickFormat(d3.format(".2s"));

    legend.append("g")
      .attr("transform", `translate(0,${legendHeight})`)
      .call(legendAxis)
      .selectAll("text")
      .style("font-size", "9px");
  }
})();

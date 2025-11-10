// js/main.js
(async function () {
  // load data
  let rows;
  try {
    rows = await d3.csv("data/cleanedData.csv");
  } catch (err) {
    console.error("CSV load error:", err);
    d3.select("body").append("div").text("Could not load data/cleanedData.csv");
    return;
  }

  // normalise columns (handles UPPERCASE from KNIME)
  rows.forEach(d => {
    d.year = +(d.year || d.YEAR || 0);
    d.jurisdiction = d.jurisdiction || d.JURISDICTION || "";
    d.location = d.location || d.LOCATION || "";
    d.age_group = d.age_group || d.AGE_GROUP || "";
    d.detection_method = d.detection_method || d.DETECTION_METHOD || "";
    d.drug_type = d.drug_type || d.DRUG_TYPE || "";
    d.positive_count = +(d.positive_count || d.POSITIVE_COUNT || d.count || d.COUNT || 0);
  });

  // build unique lists
  const years = Array.from(new Set(rows.map(d => d.year))).filter(Boolean).sort((a, b) => b - a);
  const jurs = Array.from(new Set(rows.map(d => d.jurisdiction))).filter(Boolean).sort();
  const drugs = Array.from(new Set(rows.map(d => d.drug_type))).filter(Boolean).sort();

  // state (multiple)
  const state = {
    data: rows,
    years: new Set([years[0]]), // start with latest year selected
    jurisdictions: new Set(),   // empty = all
    drugs: new Set(),           // empty = all
    sort: "desc"
  };

  // ---------- render year pills ----------
  const yearPills = d3.select("#yearPills");
  years.forEach(y => {
    yearPills.append("button")
      .attr("class", `pill ${state.years.has(y) ? "active" : ""}`)
      .attr("data-year", y)
      .text(y);
  });

  // toggle year on click (multiple)
  d3.selectAll("#yearPills .pill").on("click", function () {
    const y = +this.getAttribute("data-year");
    if (state.years.has(y)) {
      // if it’s the last one, keep at least 1 year
      if (state.years.size > 1) {
        state.years.delete(y);
      }
    } else {
      state.years.add(y);
    }
    // update active class
    d3.selectAll("#yearPills .pill").classed("active", function () {
      const yy = +this.getAttribute("data-year");
      return state.years.has(yy);
    });
    renderAll();
  });

  // ---------- render multi-selects ----------
  const jurSel = d3.select("#jurSelect");
  jurs.forEach(j => {
    jurSel.append("option").attr("value", j).text(j);
  });

  const drugSel = d3.select("#drugSelect");
  drugs.forEach(dr => {
    drugSel.append("option").attr("value", dr).text(dr);
  });

  // helper to read multiple from <select multiple>
  function getSelectedValues(selectElem) {
    const opts = Array.from(selectElem.options);
    return opts.filter(o => o.selected).map(o => o.value);
  }

  // on change jurisdiction
  jurSel.on("change", function () {
    const selected = getSelectedValues(this);
    state.jurisdictions = new Set(selected);
    renderAll();
  });

  // on change drug
  drugSel.on("change", function () {
    const selected = getSelectedValues(this);
    state.drugs = new Set(selected);
    renderAll();
  });

  // sorter
  const sortSel = d3.select("#sortSelect");
  sortSel.on("change", function () {
    state.sort = this.value;
    renderAll();
  });

  // reset
  d3.select("#resetBtn").on("click", () => {
    state.years = new Set([years[0]]);
    state.jurisdictions = new Set();
    state.drugs = new Set();
    state.sort = "desc";

    // reset UI
    d3.selectAll("#yearPills .pill").classed("active", function () {
      const yy = +this.getAttribute("data-year");
      return yy === years[0];
    });
    Array.from(jurSel.node().options).forEach(o => (o.selected = false));
    Array.from(drugSel.node().options).forEach(o => (o.selected = false));
    sortSel.property("value", "desc");

    renderAll();
  });

  // ---------- filtering ----------
  function getFilteredData() {
    return state.data.filter(d => {
      const yearOK = state.years.has(d.year);
      const jurOK = state.jurisdictions.size === 0 || state.jurisdictions.has(d.jurisdiction);
      const drugOK = state.drugs.size === 0 || state.drugs.has(d.drug_type);
      return yearOK && jurOK && drugOK;
    });
  }

  // ---------- render all charts ----------
  function renderAll() {
    const filtered = getFilteredData();
    renderAgeChart(filtered);
    renderMethodChart(filtered);
    renderLocationChart(filtered, state.sort);
  }

  // initial render
  renderAll();

  // ----------------- charts -----------------

  function renderAgeChart(data) {
    const container = d3.select("#ageChart");
    container.selectAll("*").remove();
    const width = container.node().clientWidth;
    const height = 250;
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };

    const grouped = d3.rollups(
      data,
      v => d3.sum(v, d => d.positive_count),
      d => d.age_group
    )
      .map(([age_group, total]) => ({ age_group, total }))
      .filter(d => d.age_group && d.age_group !== "All ages")
      .sort((a, b) => d3.ascending(a.age_group, b.age_group));

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height);

    const x = d3.scaleBand()
      .domain(grouped.map(d => d.age_group))
      .range([margin.left, width - margin.right])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(grouped, d => d.total) || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end")
      .style("font-size", "10px");

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5));

    svg.selectAll("rect")
      .data(grouped)
      .enter()
      .append("rect")
      .attr("x", d => x(d.age_group))
      .attr("y", d => y(d.total))
      .attr("width", x.bandwidth())
      .attr("height", d => (height - margin.bottom) - y(d.total))
      .attr("fill", "#0b5ed7")
      .append("title")
      .text(d => `${d.age_group}: ${d.total.toLocaleString()}`);
  }

  function renderMethodChart(data) {
    const container = d3.select("#methodChart");
    container.selectAll("*").remove();
    const width = container.node().clientWidth;
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
      .attr("width", width)
      .attr("height", height);

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
      .attr("height", d => (height - margin.bottom) - y(d.total))
      .attr("fill", "#f38b4f")
      .append("title")
      .text(d => `${d.detection_method}: ${d.total.toLocaleString()}`);
  }

  function renderLocationChart(data, sortMode) {
    const container = d3.select("#locationChart");
    container.selectAll("*").remove();
    const width = container.node().clientWidth;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 30, left: 160 };

    let grouped = d3.rollups(
      data,
      v => d3.sum(v, d => d.positive_count),
      d => d.location
    )
      .map(([location, total]) => ({ location, total }))
      .filter(d => d.location);

    if (sortMode === "desc") {
      grouped.sort((a, b) => d3.descending(a.total, b.total));
    } else if (sortMode === "asc") {
      grouped.sort((a, b) => d3.ascending(a.total, b.total));
    } else if (sortMode === "alpha") {
      grouped.sort((a, b) => d3.ascending(a.location, b.location));
    }

    grouped = grouped.slice(0, 12);

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height);

    const y = d3.scaleBand()
      .domain(grouped.map(d => d.location))
      .range([margin.top, height - margin.bottom])
      .padding(0.25);

    const x = d3.scaleLinear()
      .domain([0, d3.max(grouped, d => d.total) || 1])
      .nice()
      .range([margin.left, width - margin.right]);

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll("text")
      .style("font-size", "10px");

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5));

    svg.selectAll("rect")
      .data(grouped)
      .enter()
      .append("rect")
      .attr("x", x(0))
      .attr("y", d => y(d.location))
      .attr("width", d => x(d.total) - x(0))
      .attr("height", y.bandwidth())
      .attr("fill", "#d72638")
      .append("title")
      .text(d => `${d.location}: ${d.total.toLocaleString()}`);
  }
})();

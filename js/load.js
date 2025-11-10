// js/load.js (debug version)
(async function () {
  console.log("🟦 starting dashboard load…");

  // 1. try standard paths
  const csvPath = "data/cleanedData.csv";
  const geoPath = "data/australia_states.geojson";

  try {
    const [rows, aus] = await Promise.all([
    d3.csv("cleanedData.csv"),
    d3.json("australia_states.geojson")
    ]);

    console.log("✅ CSV loaded:", rows.length, "rows");
    console.log("🔎 first 5 rows:", rows.slice(0, 5));
    console.log("✅ GeoJSON loaded:", aus.features ? aus.features.length : aus);

    // guess column names (because sometimes they are uppercase)
    // normalize columns:
    rows.forEach(d => {
      // try common variants
      d.year = +(d.year || d.YEAR || d.Year || 0);
      d.jurisdiction = d.jurisdiction || d.JURISDICTION || d.state || d.State || "";
      d.location = d.location || d.LOCATION || d.Location || "";
      d.age_group = d.age_group || d.AGE_GROUP || d.Age_Group || "";
      d.drug_type = d.drug_type || d.DRUG_TYPE || d.Drug_Type || "";
      d.detection_method = d.detection_method || d.DETECTION_METHOD || "";
      d.positive_count = +(d.positive_count || d.POSITIVE_COUNT || d.count || d.COUNT || 0);
    });

    // build filter options from the normalized data
    const years = Array.from(new Set(rows.map(d => d.year))).filter(Boolean).sort((a,b)=>a-b);
    const jurs = Array.from(new Set(rows.map(d => d.jurisdiction))).filter(Boolean).sort();
    const drugs = Array.from(new Set(rows.map(d => d.drug_type))).filter(Boolean).sort();

    const yearSel = d3.select("#yearSelect");
    years.forEach(y => yearSel.append("option").attr("value", y).text(y));
    yearSel.property("value", years[years.length - 1] || "");

    const jurSel = d3.select("#jurSelect");
    jurSel.append("option").attr("value", "All").text("All");
    jurs.forEach(j => jurSel.append("option").attr("value", j).text(j));

    const drugSel = d3.select("#drugSelect");
    drugSel.append("option").attr("value", "All").text("All");
    drugs.forEach(dr => drugSel.append("option").attr("value", dr).text(dr));

    const state = {
      data: rows,
      geo: aus,
      year: years[years.length - 1],
      jur: "All",
      drug: "All"
    };

    function applyFilters() {
      const filtered = state.data.filter(d => {
        const yearOK = !state.year || d.year === +state.year;
        const jurOK = state.jur === "All" || d.jurisdiction === state.jur;
        const drugOK = state.drug === "All" || d.drug_type === state.drug;
        return yearOK && jurOK && drugOK;
      });

      console.log("📊 filtered rows:", filtered.length);

      renderAgeChart(filtered);
      renderLocationChart(filtered);
      renderMapChart(state.data, state.geo, state.year);
    }

    // initial render
    applyFilters();

    yearSel.on("change", function () {
      state.year = +this.value;
      applyFilters();
    });

    jurSel.on("change", function () {
      state.jur = this.value;
      applyFilters();
    });

    drugSel.on("change", function () {
      state.drug = this.value;
      applyFilters();
    });

    d3.select("#resetBtn").on("click", () => {
      yearSel.property("value", years[years.length - 1] || "");
      jurSel.property("value", "All");
      drugSel.property("value", "All");
      state.year = years[years.length - 1];
      state.jur = "All";
      state.drug = "All";
      applyFilters();
    });

  } catch (err) {
    console.error("❌ error loading data:", err);
    d3.select("body")
      .append("div")
      .style("background", "#fee")
      .style("color", "#900")
      .style("padding", "1rem")
      .text("Error loading data. Check console for details.");
  }
})();

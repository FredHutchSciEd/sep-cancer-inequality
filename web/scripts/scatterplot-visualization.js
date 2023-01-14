// Set the dimensions and margins of the graph
const MARGIN = { top: 30, right: 30, bottom: 60, left: 60 };

// Max width, in pixels, for the scatterplot.
const MAX_WIDTH = 600;

/**
 * @param {Array<Object>} data 
 * @param {string} metric
 * @returns {number[]} A two-element array with the range that should be used.
 */
function getDataRange(data, metric) {
    const min = d3.min(data, (d) => d[metric]);
    const max = d3.max(data, (d) => d[metric]);

    return [min, max];
}

/**
 * Join the two datasets in preparation for rendering.
 * @param {Array<Object>} data1 first list of data entries
 * @param {string} metric2 metric for the second list of data entries
 * @param {Array<Object>} data2 second list of data entries
 * @param {boolean} adjustState whether the FIPS should be adjusted to state
 * @returns 
 */
function joinData(data1, metric2, data2, adjustState) {
    let joined = [...data1];
    let map = new Map(data2.map(i => [i["fips"], i[metric2]]));
    return joined.map(d => {
        const key = adjustState ? Math.floor(d["fips"] / 1000) : d["fips"];
        d[metric2] = map.get(key);
        return d;
    });
}

/**
 * Update the scatterplot to show the relationship between the two variables.
 * @param {string} xMetric 
 * @param {string} yMetric 
 */
async function updateScatterplot(xMetric, yMetric) {
    // Clear any past svg elements
    d3.select("#canvas_scatterplot").selectAll("*").remove();

    // Get the width for the scatterplot element.
    const clientWidth = Math.min(
        document.getElementById("canvas_scatterplot").clientWidth,
        MAX_WIDTH
    );
    const w = clientWidth - MARGIN.left - MARGIN.right;
    const h = 400 - MARGIN.top - MARGIN.bottom;

    // Attach an svg to the Append the svg object to the body of the page
    const scatterplot = d3.select("#canvas_scatterplot")
        .append("svg")
        .attr("width", w + MARGIN.left + MARGIN.right)
        .attr("height", h + MARGIN.top + MARGIN.bottom)
        .append("g")
        .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`);

    // Read the data
    const [xData, yData] =
        await Promise.all([getData(xMetric), getData(yMetric)]);

    // Join the data
    let data = [];
    const xType = getMetricType(xMetric);
    const yType = getMetricType(yMetric);
    if ((xType === "county" && yType === "county")
        || (xType === "state" && yType === "state")) {
        data = joinData(xData, yMetric, yData, false);
    } else if (xType === "county" && yType === "state") {
        data = joinData(xData, yMetric, yData, true);
    } else if (xType === "state" && yType === "county") {
        data = joinData(yData, xMetric, xData, true);
    } else {
        throw Error("Unsupported metric combination");
    }

    // Remove any missing datapoints    
    data = data.filter(d => d[xMetric] && d[yMetric]);

    // Add X axis
    const xRange = getDataRange(data, xMetric);
    const x = d3.scaleLinear().domain(xRange).range([0, w]);
    scatterplot.append("g")
        .attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("~s")));
    scatterplot.append("text")
        .attr("text-anchor", "middle")
        .attr("x", w / 2)
        .attr("y", h + MARGIN.top + 15)
        .text(getMetricLabel(xMetric));

    // Add Y axis
    const y = d3.scaleLinear()
        .domain(getDataRange(data, yMetric)).range([h, 0]);
    scatterplot.append("g").call(d3.axisLeft(y).tickFormat(d3.format("~s")));
    scatterplot.append("text")
        .attr("text-anchor", "center")
        .attr("transform", "rotate(-90)")
        .attr("x", -(MARGIN.top + MARGIN.bottom + h / 2))
        .attr("y", -MARGIN.left + 20)
        .text(getMetricLabel(yMetric))

    // Add dots
    scatterplot.append("g")
        .selectAll("dot")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d[xMetric]))
        .attr("cy", d => y(d[yMetric]))
        .attr("r", 1.5)
        .style("fill", "#69b3a2");

    // Add a clipPath to prevent the regression from extending outside the axes.
    scatterplot.append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", w)
        .attr("height", h);

    // Add linear regression line
    const linReg = d3.regressionLinear()
        .x(d => d[xMetric])
        .y(d => d[yMetric])
        .domain(xRange);
    scatterplot.append("g").append("line")
        .attr("class", "regression")
        .datum(linReg(data))
        .attr("x1", d => x(d[0][0]))
        .attr("x2", d => x(d[1][0]))
        .attr("y1", d => y(d[0][1]))
        .attr("y2", d => y(d[1][1]))
        .attr("stroke-width", 1)
        .attr("stroke", "black")
        .attr("clip-path", "url(#clip)");


    // Render a text summary of the relationship
    document.getElementById("scatter_relationship").innerHTML = `
        Use this scatterplot to understand how these two variables are 
        correlated. Based on the slope of the line, there is a
        <b>${linReg(data).a > 0 ? "positive" : "negative"}</b> relationship
        between the variables.`;

    // Render metric descriptions
    document.getElementById("scatter_x").innerHTML =
        `<b>${getMetricLabel(xMetric)}</b>: ${getMetricDescription(xMetric)}`;
    document.getElementById("scatter_y").innerHTML =
        `<b>${getMetricLabel(yMetric)}</b>: ${getMetricDescription(yMetric)}`;
}
// Builds table rows with DOM APIs instead of HTML strings, so user data
// (URLs, titles, patterns) is only ever set as text.
const SVG_NS = "http://www.w3.org/2000/svg";
function removeIcon() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("height", "24px");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "24px");
    svg.setAttribute("fill", "#000000");
    const bg = document.createElementNS(SVG_NS, "path");
    bg.setAttribute("d", "M0 0h24v24H0V0z");
    bg.setAttribute("fill", "none");
    const cross = document.createElementNS(SVG_NS, "path");
    cross.setAttribute("d", "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z");
    svg.append(bg, cross);
    return svg;
}
function tableRow(attrs, cells, removable) {
    const tr = document.createElement("tr");
    Object.entries(attrs).forEach(([k, v]) => tr.setAttribute(k, v));
    cells.forEach(text => {
        const td = document.createElement("td");
        const p = document.createElement("p");
        p.textContent = text;
        td.appendChild(p);
        tr.appendChild(td);
    });
    if (removable) {
        const td = document.createElement("td");
        const button = document.createElement("button");
        button.className = "remove";
        button.appendChild(removeIcon());
        td.appendChild(button);
        tr.appendChild(td);
    }
    return tr;
}

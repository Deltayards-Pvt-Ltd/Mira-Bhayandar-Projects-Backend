/**
 * Derive unique locality + configuration filter options from project documents.
 * Config ids support fractional BHK (e.g. 3.5-bhk) and special types like jodi.
 */

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} label
 */
export function slugFromLabel(label) {
  return norm(label)
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * @param {string} title
 * @returns {Set<number>}
 */
export function bhkCountsInTitle(title) {
  const s = norm(title);
  const out = new Set();
  const add = (n) => {
    if (Number.isFinite(n) && n > 0) out.add(n);
  };

  if (s.includes("bhk")) {
    const head = s.split("bhk")[0];
    for (const part of head.split(/[&+/|]/)) {
      const d = part.match(/(\d+(?:\.\d+)?)/);
      if (d) add(Number(d[1]));
    }
  }

  const re = /(\d+(?:\.\d+)?)\s*bhk/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    add(Number(m[1]));
  }

  return out;
}

/**
 * @param {number} n
 */
export function bhkConfigId(n) {
  const s = String(n);
  return `${s}-bhk`;
}

/**
 * @param {string} configId
 */
export function bhkConfigLabel(configId) {
  const m = String(configId).match(/^(\d+(?:\.\d+)?)-bhk$/i);
  if (!m) return null;
  return `${m[1]} BHK`;
}

/**
 * @param {string} title
 * @returns {string[]} config ids found in a layout title
 */
export function configIdsFromLayoutTitle(title) {
  const ids = new Set();
  const s = norm(title);
  if (s.includes("jodi")) ids.add("jodi");
  for (const n of bhkCountsInTitle(title)) {
    ids.add(bhkConfigId(n));
  }
  return [...ids];
}

/**
 * @param {string} configId
 */
export function configIdToLabel(configId) {
  if (configId === "jodi") return "Jodi";
  const bhk = bhkConfigLabel(configId);
  if (bhk) return bhk;
  return configId;
}

/**
 * @param {string} a
 * @param {string} b
 */
function compareConfigIds(a, b) {
  if (a === "jodi" && b === "jodi") return 0;
  if (a === "jodi") return 1;
  if (b === "jodi") return -1;
  const na = Number(a.replace(/-bhk$/i, ""));
  const nb = Number(b.replace(/-bhk$/i, ""));
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b);
}

/**
 * @param {string} a
 * @param {string} b
 */
function compareLabels(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

/**
 * @param {Array<{ location?: string; layouts?: Array<{ title?: string }> }>} projects
 * @returns {{ localities: Array<{ id: string; label: string }>; configurations: Array<{ id: string; label: string }> }}
 */
export function buildProjectFilterOptions(projects) {
  /** @type {Map<string, string>} id -> label */
  const localityMap = new Map();
  /** @type {Set<string>} */
  const configIds = new Set();

  for (const project of projects || []) {
    const loc = String(project?.location || "").trim();
    if (loc) {
      const id = slugFromLabel(loc);
      if (id && !localityMap.has(id)) localityMap.set(id, loc);
    }
    for (const layout of project?.layouts || []) {
      const title = layout?.title;
      if (!title) continue;
      for (const cid of configIdsFromLayoutTitle(title)) {
        configIds.add(cid);
      }
    }
  }

  const localities = [...localityMap.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => compareLabels(a.label, b.label));

  const configurations = [...configIds]
    .sort(compareConfigIds)
    .map((id) => ({ id, label: configIdToLabel(id) }));

  return { localities, configurations };
}

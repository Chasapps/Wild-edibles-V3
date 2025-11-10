
/* Wild Fruit Mapper — Pro (with Categories + Catalog or GeoJSON Import) */

const LS_KEY = 'wild_fruit_trees_v1';
const MASTER_LS_KEY = 'wild_fruit_master_v1';

const FRUIT_EMOJI = {
  Apple:'🍎', Pear:'🍐', Plum:'🍑', Peach:'🍑', Apricot:'🍑',
  Orange:'🍊', Grapefruit:'🍊', Lemon:'🍋', Lime:'🍈',
  Mulberry:'🫐', Berry:'🫐', Fig:'🟣', Olive:'🫒', Loquat:'🍑',
  Cherry:'🍒', Banana:'🍌', Mango:'🥭', Guava:'🥭', Feijoa:'🥝',
  Persimmon:'🟠', Other:'🌱', Pomegranate:'🔴'
};

const DEFAULT_CATALOG = {
  native_fruits: [
    {name:"Finger Lime",emoji:"🍈"}, {name:"Kakadu Plum",emoji:"🍏"},
    {name:"Riberry (Lilly Pilly)",emoji:"🍒"}, {name:"Quandong (Native Peach)",emoji:"🍒"},
    {name:"Muntries",emoji:"🍇"}, {name:"Midyim Berry",emoji:"🍓"}, {name:"Desert Lime",emoji:"🍋"}
  ],
  common_fruits: [
    {name:"Mulberry",emoji:"🍇"}, {name:"Loquat",emoji:"🍑"}, {name:"Avocado",emoji:"🥑"},
    {name:"Mango",emoji:"🥭"}, {name:"Banana",emoji:"🍌"}, {name:"Fig",emoji:"🟣"}, {name:"Olive",emoji:"🫒"}
  ],
  edible_plants: [
    {name:"Warrigal Greens",emoji:"🥬"}, {name:"Lemon Myrtle",emoji:"🌿"},
    {name:"River Mint",emoji:"🌿"}, {name:"Saltbush",emoji:"🌿"}
  ]
};

let MASTER = DEFAULT_CATALOG;
try { const raw = localStorage.getItem(MASTER_LS_KEY); if (raw) MASTER = JSON.parse(raw); } catch {}

function emojiForName(name){
  if (FRUIT_EMOJI[name]) return FRUIT_EMOJI[name];
  for (const bucket of ['native_fruits','common_fruits','edible_plants']) {
    const hit = (MASTER[bucket]||[]).find(x => x.name === name);
    if (hit && hit.emoji) return hit.emoji;
  }
  return '🌱';
}

const map = L.map('map');
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
map.setView([-33.8688, 151.2093], 12);

try {
  const appbarEl = document.querySelector('.appbar');
  if (appbarEl) {
    L.DomEvent.disableClickPropagation(appbarEl);
    L.DomEvent.disableScrollPropagation(appbarEl);
  }
} catch (_) {}

let clusterLayer = L.markerClusterGroup({ maxClusterRadius: 60 });
let plainLayer = L.layerGroup();
map.addLayer(clusterLayer);
let useCluster = true;

let trees = loadTrees();
let markerIndex = new Map();

const locateBtn = document.getElementById('locateBtn');
const addBtn = document.getElementById('addBtn');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
const statsBtn = document.getElementById('statsBtn');
const clearBtn = document.getElementById('clearBtn');
const clusterToggle = document.getElementById('clusterToggle');
const catalogInput = document.getElementById('catalogInput');

const dialogEl = document.getElementById('formDialog');
const form = document.getElementById('treeForm');
const formTitle = document.getElementById('formTitle');
const fruitSelect = document.getElementById('fruitSelect');
const fruitCustom = document.getElementById('fruitCustom');
const season = document.getElementById('season');
const ripeness = document.getElementById('ripeness');
const notes = document.getElementById('notes');
const lat = document.getElementById('lat');
const lng = document.getElementById('lng');
const photoInput = document.getElementById('photoInput');
const editingId = document.getElementById('editingId');
const categorySelect = document.getElementById('categorySelect');

const fType = document.getElementById('fType');
const fSeason = document.getElementById('fSeason');
const fRipeness = document.getElementById('fRipeness');
const fText = document.getElementById('fText');
const fHasPhoto = document.getElementById('fHasPhoto');
const applyFiltersBtn = document.getElementById('applyFilters');
const resetFiltersBtn = document.getElementById('resetFilters');

const popupTpl = document.getElementById('popupTpl');

(function initFilterTypeOptions(){
  const set = new Set(['Apple','Pear','Plum','Peach','Apricot','Orange','Lemon','Lime','Grapefruit','Mulberry','Fig','Olive','Loquat','Cherry','Banana','Mango','Guava','Feijoa','Persimmon','Pomegranate','Berry','Other']);
  for (const t of set){
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = (FRUIT_EMOJI[t]||'') + ' ' + t;
    fType.appendChild(opt);
  }
})();

function getNamesForCategory(catKey){
  const list = (MASTER[catKey] || []).map(x => x.name);
  if (list && list.length) return list;
  return (DEFAULT_CATALOG[catKey] || []).map(x=>x.name);
}
function refillFruitOptions(){
  if (!fruitSelect) return;
  const catKey = categorySelect?.value || 'native_fruits';
  const names = getNamesForCategory(catKey);
  fruitSelect.innerHTML = '';
  for (const t of names){
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = `${emojiForName(t)} ${t}`;
    fruitSelect.appendChild(opt);
  }
  const otherOpt = document.createElement('option');
  otherOpt.value = 'Other'; otherOpt.textContent = '🌱 Other (custom)';
  fruitSelect.appendChild(otherOpt);
  fruitSelect.value = names[0] || 'Other';
  if (fruitCustom) fruitCustom.value = '';
}
categorySelect?.addEventListener('change', refillFruitOptions);

renderAll();

async function goToMyLocation(panOnly=false){
  if(!('geolocation' in navigator)) return toast('Geolocation not available');
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude, accuracy } = pos.coords;
      map.setView([latitude, longitude], Math.max(map.getZoom(), 16));
      if (!panOnly) toast(`📍 Located (±${Math.round(accuracy)} m)`);
      resolve({lat:latitude, lng:longitude, accuracy});
    }, err => {
      toast('Location error: ' + err.message);
      resolve(null);
    }, { enableHighAccuracy:true, timeout:10000, maximumAge:0 });
  });
}

function loadTrees(){
  try { return JSON.parse(localStorage.getItem(LS_KEY)) ?? []; }
  catch { return []; }
}
function saveTrees(){ localStorage.setItem(LS_KEY, JSON.stringify(trees)); }

function buildMarker(tree){
  const emoji = emojiForName(tree.type);
  const icon = L.divIcon({ className:'fruit-icon', html:`<div style="font-size:24px">${emoji}</div>`, iconSize:[24,24], iconAnchor:[12,12] });
  const m = L.marker([tree.lat, tree.lng], { icon });
  m.bindPopup(renderPopup(tree));
  return m;
}

function passesFilters(t){
  const types = Array.from(fType.selectedOptions).map(o=>o.value);
  if (types.length && !types.includes(t.type)) return false;
  if (fSeason.value && t.season !== fSeason.value) return false;
  if (fRipeness.value && t.ripeness !== fRipeness.value) return false;
  const q = fText.value.trim().toLowerCase();
  if (q && !(t.notes||'').toLowerCase().includes(q)) return false;
  if (fHasPhoto.checked && !t.photoDataUrl) return false;
  return true;
}

function renderAll(){
  clusterLayer.clearLayers();
  plainLayer.clearLayers();
  markerIndex.clear();
  const layer = useCluster ? clusterLayer : plainLayer;
  if (!map.hasLayer(layer)) {
    map.removeLayer(useCluster ? plainLayer : clusterLayer);
    map.addLayer(layer);
  }
  const visible = [];
  for (const t of trees){
    if (!passesFilters(t)) continue;
    const m = buildMarker(t);
    layer.addLayer(m);
    markerIndex.set(t.id, m);
    visible.push(t);
  }
  if (visible.length){
    const group = L.featureGroup(visible.map(t=> L.marker([t.lat,t.lng])));
    map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 17 });
  }
}

function renderPopup(tree){
  const tpl = popupTpl.content.cloneNode(true);
  tpl.querySelector('.emoji').textContent = emojiForName(tree.type);
  tpl.querySelector('.name').textContent = ` ${tree.type}` + (tree.ripeness?` • ${tree.ripeness}`:'');
  tpl.querySelector('.coords').textContent = `${tree.lat.toFixed(6)}, ${tree.lng.toFixed(6)}`;
  const meta = [];
  if (tree.category){ meta.push({native_fruits:'🇦🇺 Native',common_fruits:'🍊 Common',edible_plants:'🌿 Edible plant'}[tree.category] || tree.category); }
  if (tree.season) meta.push(tree.season);
  meta.push(new Date(tree.created).toLocaleString());
  tpl.querySelector('.meta').textContent = meta.join(' • ');
  tpl.querySelector('.notes').textContent = tree.notes || '';
  const photoWrap = tpl.querySelector('.photoWrap');
  if (tree.photoDataUrl){
    const img = document.createElement('img');
    img.src = tree.photoDataUrl; img.alt='Tree photo';
    photoWrap.appendChild(img);
  }
  const root = document.createElement('div');
  root.appendChild(tpl);
  root.querySelector('[data-action="edit"]').addEventListener('click', () => openEdit(tree.id));
  root.querySelector('[data-action="delete"]').addEventListener('click', () => delTree(tree.id));
  return root;
}

async function openAdd(){
  form.reset();
  formTitle.textContent = 'Add Tree';
  editingId.value = '';
  if (categorySelect) categorySelect.value = categorySelect.value || 'native_fruits';
  refillFruitOptions();
  const pos = await goToMyLocation(true);
  if (pos){ lat.value = pos.lat; lng.value = pos.lng; }
  dialogEl.showModal();
}
function openEdit(id){
  const t = trees.find(x=>x.id===id);
  if (!t) return;
  formTitle.textContent = 'Edit Tree';
  editingId.value = t.id;
  if (categorySelect) categorySelect.value = t.category || 'native_fruits';
  refillFruitOptions();
  const known = getNamesForCategory(categorySelect.value);
  fruitSelect.value = known.includes(t.type) ? t.type : 'Other';
  fruitCustom.value = (fruitSelect.value === 'Other') ? t.type : '';
  season.value = t.season || '';
  ripeness.value = t.ripeness || '';
  notes.value = t.notes || '';
  lat.value = t.lat;
  lng.value = t.lng;
  dialogEl.showModal();
}

function fileToDataUrl(file, maxW=1200, maxH=1200, quality=0.7){
  return new Promise((resolve,reject)=>{
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxW/img.width, maxH/img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width*scale);
        canvas.height = Math.round(img.height*scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function submitForm(e){
  e?.preventDefault();
  const id = editingId.value || crypto.randomUUID();
  const type = fruitSelect.value === 'Other' ? (fruitCustom.value.trim() || 'Other') : fruitSelect.value;
  const entry = {
    id,
    type,
    category: categorySelect?.value || 'native_fruits',
    season: season.value || '',
    ripeness: ripeness.value || '',
    notes: notes.value.trim(),
    lat: Number(lat.value),
    lng: Number(lng.value),
    created: editingId.value ? (trees.find(t=>t.id===id)?.created || Date.now()) : Date.now(),
    photoDataUrl: undefined
  };
  const file = photoInput.files?.[0];
  if (file) {
    try { entry.photoDataUrl = await fileToDataUrl(file); }
    catch { toast('Could not process photo (saving without).'); }
  } else if (editingId.value){
    entry.photoDataUrl = (trees.find(t=>t.id===id)||{}).photoDataUrl;
  }

  const idx = trees.findIndex(t=>t.id===id);
  if (idx>=0) trees[idx] = entry; else trees.push(entry);
  saveTrees();
  renderAll();
  dialogEl.close();
  toast('Saved ✅');
}

function delTree(id){
  if (!confirm('Delete this entry?')) return;
  trees = trees.filter(t=>t.id!==id);
  saveTrees();
  renderAll();
  toast('Deleted');
}

function exportGeoJSON(){
  const fc = {
    type:'FeatureCollection',
    features: trees.map(t => ({
      type:'Feature',
      id:t.id,
      properties:{
        type:t.type, category: t.category || null, season:t.season, ripeness:t.ripeness,
        notes:t.notes, created:t.created, photo:t.photoDataUrl||null
      },
      geometry:{ type:'Point', coordinates:[t.lng, t.lat] }
    }))
  };
  const blob = new Blob([JSON.stringify(fc,null,2)], {type:'application/geo+json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  a.download = `wild-fruit-${stamp}.geojson`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

function importGeoJSONFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if (data && data.native_fruits && data.common_fruits && data.edible_plants){
        MASTER = data; localStorage.setItem(MASTER_LS_KEY, JSON.stringify(MASTER));
        refillFruitOptions();
        toast('Catalog loaded ✅');
        return;
      }
      if (data.type !== 'FeatureCollection') throw new Error('Not a FeatureCollection');
      const imported = [];
      for (const f of data.features || []){
        if (f.geometry?.type !== 'Point') continue;
        const [lngVal, latVal] = f.geometry.coordinates || [];
        const props = f.properties || {};
        const entry = {
          id: f.id || crypto.randomUUID(),
          type: props.type || 'Other',
          category: props.category || 'native_fruits',
          season: props.season || '',
          ripeness: props.ripeness || '',
          notes: props.notes || '',
          lat: Number(latVal),
          lng: Number(lngVal),
          created: Number(props.created) || Date.now(),
          photoDataUrl: props.photo || null
        };
        const idx = trees.findIndex(t=>t.id===entry.id);
        if (idx>=0) trees[idx] = entry; else trees.push(entry);
        imported.push(entry);
      }
      saveTrees();
      renderAll();
      toast(`Imported ${imported.length} point(s)`);
    }catch(err){
      toast('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function showStats(){
  const byType = trees.reduce((acc,t)=>{ acc[t.type]=(acc[t.type]||0)+1; return acc; },{});
  const total = trees.length;
  const kinds = Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ${v}`).join('\\n');
  alert(`Total trees: ${total}\\n\\nBy type:\\n${kinds||'(none)'}`);
}

let toastTimer;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 2000);
}

locateBtn.addEventListener('click', ()=>goToMyLocation());
addBtn.addEventListener('click', openAdd);
exportBtn.addEventListener('click', exportGeoJSON);
importInput.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) importGeoJSONFile(file);
  e.target.value = '';
});
catalogInput?.addEventListener('change', e => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const json = JSON.parse(reader.result);
      if (!json.native_fruits || !json.common_fruits || !json.edible_plants) throw new Error('Invalid catalog JSON');
      MASTER = json; localStorage.setItem(MASTER_LS_KEY, JSON.stringify(MASTER));
      refillFruitOptions(); toast('Catalog loaded ✅');
    }catch(err){ toast('Catalog load failed: ' + err.message); }
    finally{ e.target.value=''; }
  };
  reader.readAsText(file);
});
statsBtn.addEventListener('click', showStats);
clearBtn.addEventListener('click', () => {
  if (!confirm('Clear ALL saved entries?')) return;
  trees = []; saveTrees(); renderAll(); toast('Cleared all');
});
form.addEventListener('submit', submitForm);
document.getElementById('cancelBtn').addEventListener('click', ()=>dialogEl.close());

applyFiltersBtn.addEventListener('click', renderAll);
resetFiltersBtn.addEventListener('click', () => {
  fType.selectedIndex = -1;
  fSeason.value=''; fRipeness.value=''; fText.value=''; fHasPhoto.checked=false;
  renderAll();
});
[fSeason,fRipeness,fText,fHasPhoto].forEach(el => el.addEventListener('change', renderAll));
clusterToggle.addEventListener('change', () => { useCluster = clusterToggle.checked; renderAll(); });

refillFruitOptions();
goToMyLocation(true);

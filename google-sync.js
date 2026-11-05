/* Read-only Google integration; credentials and private sheet data stay out of the repository. */
(() => {
  const CLIENT = '979717313307-74p9fk2inhkogmupjdmnrlal6jab015l.apps.googleusercontent.com';
  const SHEET = '16gguTT_UjMX-tppf95AW5spYVquDX4X8mV8cGn_cL8Y';
  const ROOT = '14bwOFR4w6st8WCgkPMU7TCdpOr7d-3yp';
  const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly';
  let token = '', expires = 0, busy = false, timer;
  const norm = s => String(s || '').toLowerCase().replace(/С‘/g, 'Рµ').replace(/[В«В»"']/g, '').replace(/\s+/g, ' ').trim();
  const companyName = s => String(s || '').replace(/\s+\d+\s+Р°РєРєР°СѓРЅС‚.*$/i, '').trim();
  const key = s => {
    let n = norm(companyName(s)).replace(/\s/g, '');
    if (['СЃРєСЌРІРµСЂРµСЃС‚','СЌРІРµСЂРµСЃС‚'].includes(n)) n = 'СЌРІРµСЂРµСЃС‚';
    if (['СЃРєРЅРѕРІС‹Р№РґРѕРј','РЅРѕРІС‹Р№РґРѕРј'].includes(n)) n = 'РЅРѕРІС‹Р№РґРѕРј';
    if (['РґРѕРјРєРѕРјР»РїРµРєС‚С‹','РґРѕРјРєРѕРјРїР»РµРєС‚С‹','РґРѕРјРєРѕРјРїР»РµРєС‚'].includes(n)) n = 'РґРѕРјРєРѕРјРїР»РµРєС‚';
    if (['Р·Р°Р±С‹РєРёРЅС‹СЃС‚СЂРѕСЏС‚','Р·Р°Р±РµР»РєРёРЅС‹СЃС‚СЂРѕСЏС‚'].includes(n)) n = 'Р·Р°Р±РµР»РєРёРЅС‹СЃС‚СЂРѕСЏС‚';
    return n;
  };
  const urlOf = cell => {
    const candidates = [cell?.hyperlink, cell?.userEnteredFormat?.textFormat?.link?.uri,
      ...(cell?.textFormatRuns || []).map(r => r.format?.link?.uri), cell?.formattedValue,
      cell?.userEnteredValue?.stringValue];
    const formula = cell?.userEnteredValue?.formulaValue || '';
    const m = formula.match(/HYPERLINK\(\s*"([^"]+)"/i); if (m) candidates.push(m[1]);
    return candidates.find(v => /^https:\/\//i.test(v || '')) || '';
  };
  const textOf = c => c?.formattedValue || c?.userEnteredValue?.stringValue || '';
  async function get(url) {
    const r = await fetch(url, {headers: {Authorization: 'Bearer ' + token}});
    if (r.status === 401) { token = ''; throw new Error('Р”РѕСЃС‚СѓРї Google РёСЃС‚РµРє вЂ” РЅР°Р¶РјРёС‚Рµ В«РџРѕРґРєР»СЋС‡РёС‚СЊ GoogleВ»'); }
    if (!r.ok) throw new Error(r.status === 403 ? 'Google РЅРµ СЂР°Р·СЂРµС€РёР» С‡С‚РµРЅРёРµ вЂ” РїСЂРѕРІРµСЂСЊС‚Рµ РґРѕСЃС‚СѓРї Рє С‚Р°Р±Р»РёС†Рµ Рё РІРєР»СЋС‡РµРЅРёРµ Sheets API Рё Drive API' : 'РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРѕС‡РёС‚Р°С‚СЊ РґР°РЅРЅС‹Рµ Google');
    return r.json();
  }
  async function children(id) {
    const files = []; let page = '';
    do {
      const q = new URLSearchParams({q: "'" + id + "' in parents and trashed = false", fields: 'nextPageToken,files(id,name,mimeType,webViewLink)', pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true'});
      if (page) q.set('pageToken', page);
      const data = await get('https://www.googleapis.com/drive/v3/files?' + q);
      files.push(...(data.files || [])); page = data.nextPageToken || '';
    } while (page);
    return files;
  }
  async function collect() {
    const q = new URLSearchParams({includeGridData:'true', fields:'sheets(data(startRow,startColumn,rowData(values(formattedValue,hyperlink,userEnteredValue,textFormatRuns,userEnteredFormat(textFormat(link))))))'});
    // Read only the names, folder references and autoload links; never read account passwords.
    q.append('ranges', "'РџР РћР•РљРўР«'!A1:D97"); q.append('ranges', "'РџР РћР•РљРўР«'!J1:J97");
    const data = await get('https://sheets.googleapis.com/v4/spreadsheets/' + SHEET + '?' + q);
    const grid = [];
    for (const sheet of data.sheets || []) for (const block of sheet.data || []) (block.rowData || []).forEach((r, i) => {
      const row = (block.startRow || 0) + i; grid[row] ||= [];
      (r.values || []).forEach((c, j) => grid[row][(block.startColumn || 0) + j] = c);
    });
    if (textOf(grid[0]?.[0]) !== 'РџСЂРѕРµРєС‚' || !/reyting\.pro/.test(textOf(grid[0]?.[9]))) throw new Error('Р—Р°РіРѕР»РѕРІРєРё С‚Р°Р±Р»РёС†С‹ РёР·РјРµРЅРёР»РёСЃСЊ вЂ” РѕР±РЅРѕРІР»РµРЅРёРµ РѕСЃС‚Р°РЅРѕРІР»РµРЅРѕ');
    const folders = await children(ROOT), groups = new Map();
    for (const row of grid.slice(1)) {
      if (!row) continue;
      const raw = textOf(row[0]).trim(); if (!raw) continue;
      const k = key(raw); let g = groups.get(k);
      if (!g) { g = {key:k, name:companyName(raw), aliases:[], rows:[], autoUrls:[], folderUrls:[], funnelUrls:[]}; groups.set(k,g); }
      g.aliases.push(raw, textOf(row[3])); g.rows.push(raw);
      const auto = urlOf(row[9]); if (auto && /^https:\/\/ruchkicrm\.reyting\.pro\//i.test(auto)) g.autoUrls.push(auto);
      const direct = urlOf(row[3]);
      const matches = direct ? [{id:direct.match(/folders\/([\w-]+)/)?.[1], webViewLink:direct}] : folders.filter(f => f.mimeType === 'application/vnd.google-apps.folder' && norm(f.name) === norm(textOf(row[3])));
      if (matches.length !== 1 || !matches[0].id) continue;
      const folder = matches[0]; g.folderUrls.push(folder.webViewLink || 'https://drive.google.com/drive/folders/' + folder.id);
    }
    for (const g of groups.values()) {
      g.autoUrls = [...new Set(g.autoUrls)]; g.folderUrls = [...new Set(g.folderUrls)];
      for (const url of g.folderUrls) {
        const id = url.match(/folders\/([\w-]+)/)?.[1]; if (!id) continue;
        const items = await children(id);
        g.funnelUrls.push(...items.filter(f => /^РґР°С€Р±РѕСЂРґ(?:\s|$)/i.test(f.name) && f.mimeType === 'application/vnd.google-apps.spreadsheet').map(f => f.webViewLink || 'https://docs.google.com/spreadsheets/d/' + f.id + '/edit'));
        const materials = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder' && /^РјР°С‚РµСЂРёР°Р»С‹(?:\s|$)/i.test(f.name));
        for (const folder of materials) {
          const docs = await children(folder.id);
          g.funnelUrls.push(...docs.filter(f => /^РґР°С€Р±РѕСЂРґ(?:\s|$)/i.test(f.name) && f.mimeType === 'application/vnd.google-apps.spreadsheet').map(f => f.webViewLink || 'https://docs.google.com/spreadsheets/d/' + f.id + '/edit'));
        }
      }
      g.funnelUrls = [...new Set(g.funnelUrls)];
    }
    return [...groups.values()];
  }
  async function sync() {
    if (busy || !token || Date.now() >= expires || !db || !dashLoaded.proj || !leadsLoaded) return;
    busy = true; const info = document.getElementById('googleSyncInfo'); info.textContent = 'РћР±РЅРѕРІР»СЏРµРј СЃСЃС‹Р»РєРё РёР· GoogleвЂ¦';
    let count = 0, unmatched = 0, conflicts = 0;
    try {
      const groups = await collect();
      for (const g of groups) {
        const candidates = [...projects.values()].filter(p => key(p.sheetName || p.name) === g.key);
        const active = candidates.filter(p => p.status !== 'gone');
        const matches = active.length ? active : candidates;
        if (!matches.length) { unmatched++; continue; }
        if (matches.length > 1) { conflicts++; continue; } // Never merge finance records automatically.
        const p = matches[0], patch = {name:g.name, sheetName:g.name, sheetCompanyKey:g.key, sheetRows:g.rows};
        for (const [list, field] of [['folderUrls','folderUrl'], ['funnelUrls','funnelUrl'], ['autoUrls','autoUrl']]) {
          if (g[list].length) { patch[list] = g[list]; patch[field] = g[list][0]; }
        }
        if (!Object.entries(patch).some(([k,v]) => JSON.stringify(v) !== JSON.stringify(p[k]))) continue;
        await db.doc('projects/' + p.id).update(patch); projects.set(p.id, {...p,...patch}); count++;
      }
      syncProjNames(); dashRefresh();
      info.textContent = 'РћР±РЅРѕРІР»РµРЅРѕ: ' + count + ' В· ' + new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) + (unmatched ? ' В· Р±РµР· РєР°СЂС‚РѕС‡РєРё: ' + unmatched : '') + (conflicts ? ' В· СЃРѕРІРїР°РґРµРЅРёСЏ С‚СЂРµР±СѓСЋС‚ РїСЂРѕРІРµСЂРєРё: ' + conflicts : '');
    } catch (e) { info.textContent = e.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃСЃС‹Р»РєРё'; }
    finally { busy = false; }
  }
  const panel = document.createElement('div'); panel.className = 'bar';
  panel.innerHTML = '<div><button class="btn" id="googleSyncConnect" type="button">РџРѕРґРєР»СЋС‡РёС‚СЊ Google</button> <button class="btn" id="googleSyncRun" type="button" disabled>РћР±РЅРѕРІРёС‚СЊ СЃСЃС‹Р»РєРё</button></div><span class="hint" id="googleSyncInfo" role="status">РќР°Р·РІР°РЅРёСЏ Рё СЃСЃС‹Р»РєРё РёР· Google РўР°Р±Р»РёС†С‹ В· РѕРґРЅР° РєР°СЂС‚РѕС‡РєР° РЅР° РєРѕРјРїР°РЅРёСЋ</span>';
  document.getElementById('v-projects').before(panel); panel.hidden = true;
  new MutationObserver(() => { panel.hidden = document.getElementById('v-projects').hidden; }).observe(document.getElementById('v-projects'), {attributes:true, attributeFilter:['hidden']});
  const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; document.head.append(script);
  document.getElementById('googleSyncConnect').onclick = () => {
    if (!window.google?.accounts?.oauth2) { document.getElementById('googleSyncInfo').textContent = 'РџРѕРґРєР»СЋС‡РµРЅРёРµ Google Р·Р°РіСЂСѓР¶Р°РµС‚СЃСЏ вЂ” РїРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰Рµ СЂР°Р·'; return; }
    google.accounts.oauth2.initTokenClient({client_id:CLIENT,scope:SCOPE,callback:response => {
      if (response.error) { document.getElementById('googleSyncInfo').textContent = 'Р”РѕСЃС‚СѓРї Google РЅРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅ'; return; }
      if (!google.accounts.oauth2.hasGrantedAllScopes(response, ...SCOPE.split(' '))) { document.getElementById('googleSyncInfo').textContent = 'Р”Р»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё РЅСѓР¶РЅС‹ РѕР±Р° СЂР°Р·СЂРµС€РµРЅРёСЏ: С‚Р°Р±Р»РёС†С‹ Рё РЅР°Р·РІР°РЅРёСЏ С„Р°Р№Р»РѕРІ РЅР° Р”РёСЃРєРµ'; return; }
      token = response.access_token; expires = Date.now() + Number(response.expires_in || 3600) * 1000 - 30000;
      document.getElementById('googleSyncRun').disabled = false;
      clearInterval(timer); timer = setInterval(() => {
        if (Date.now() >= expires) { clearInterval(timer); token = ''; document.getElementById('googleSyncRun').disabled = true; document.getElementById('googleSyncInfo').textContent = 'Р”Р»СЏ РїСЂРѕРґРѕР»Р¶РµРЅРёСЏ РѕР±РЅРѕРІР»РµРЅРёР№ РЅР°Р¶РјРёС‚Рµ В«РџРѕРґРєР»СЋС‡РёС‚СЊ GoogleВ»'; return; }
        sync();
      }, 5 * 60 * 1000); sync();
    },error_callback:() => { document.getElementById('googleSyncInfo').textContent = 'РћРєРЅРѕ Google Р·Р°РєСЂС‹С‚Рѕ РёР»Рё Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ'; }}).requestAccessToken();
  };
  document.getElementById('googleSyncRun').onclick = sync;
})();


// Supabase-only data access layer
const { getSupabase } = require('./supabase');

function requireSupa(){
  const supa = getSupabase();
  if (!supa) throw new Error('Supabase not configured');
  return supa;
}

async function ensureWorkspaceForUser(user){
  const supa = requireSupa();
  const slug = user.email.split('@')[0].replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  const existing = await supa.from('workspaces').select('*').eq('owner_user_id', user.id).limit(1);
  if (existing.error) throw existing.error;
  if (existing.data.length) return existing.data[0];
  const created = await supa.from('workspaces').insert({ slug, name: slug, owner_user_id: user.id }).select();
  if (created.error) throw created.error;
  return created.data[0];
}

// Messages
async function saveMessage(record){
  const supa = requireSupa();
  const ins = await supa.from('messages').insert({
    from_number: record.from_number,
    to_number: record.to_number,
    direction: record.direction,
    text: record.text,
    meta: record.meta || {},
  }).select();
  if (ins.error) throw ins.error;
  return ins.data[0];
}

async function getMessages(limit=200, peer=null){
  const supa = requireSupa();
  let query = supa.from('messages').select('*').order('created_at', { ascending:false }).limit(limit);
  if (peer){
    query = query.or(`from_number.eq.${peer},to_number.eq.${peer}`);
  }
  const res = await query;
  if (res.error) throw res.error;
  return res.data;
}

async function upsertContact(phone, name=null){
  const supa = requireSupa();
  const existing = await supa.from('contacts').select('id').eq('phone', phone).limit(1);
  if (existing.error) throw existing.error;
  if (existing.data.length) return existing.data[0].id;
  const ins = await supa.from('contacts').insert({ phone, name }).select('id');
  if (ins.error) throw ins.error;
  return ins.data[0].id;
}

// Templates CRUD
async function createTemplate({ name, category=null, content }){
  const supa = requireSupa();
  const ins = await supa.from('templates').insert({ name, category, content, updated_at: new Date().toISOString() }).select();
  if (ins.error) throw ins.error;
  return ins.data[0];
}
async function listTemplates(limit=200){
  const supa = requireSupa();
  const res = await supa.from('templates').select('*').order('updated_at',{ascending:false}).order('created_at',{ascending:false}).limit(limit);
  if (res.error) throw res.error;
  return res.data;
}
async function getTemplateById(id){
  const supa = requireSupa();
  const res = await supa.from('templates').select('*').eq('id', id).limit(1);
  if (res.error) throw res.error;
  return res.data[0]||null;
}
async function updateTemplate(id, { name, category, content }){
  const supa = requireSupa();
  const upd = await supa.from('templates').update({ name, category, content, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (upd.error) throw upd.error;
  return upd.data[0]||null;
}
async function deleteTemplate(id){
  const supa = requireSupa();
  const del = await supa.from('templates').delete().eq('id', id);
  if (del.error) throw del.error;
  return { success:true };
}

// Automations CRUD
async function createAutomation({ name, flow_json }){
  const supa = requireSupa();
  const ins = await supa.from('automations').insert({ name, flow_json, updated_at: new Date().toISOString() }).select();
  if (ins.error) throw ins.error;
  return ins.data[0];
}
async function listAutomations(limit=200){
  const supa = requireSupa();
  const res = await supa.from('automations').select('*').order('updated_at',{ascending:false}).order('created_at',{ascending:false}).limit(limit);
  if (res.error) throw res.error;
  return res.data;
}
async function getAutomationById(id){
  const supa = requireSupa();
  const res = await supa.from('automations').select('*').eq('id', id).limit(1);
  if (res.error) throw res.error;
  return res.data[0]||null;
}
async function updateAutomation(id, { name, flow_json }){
  const supa = requireSupa();
  const upd = await supa.from('automations').update({ name, flow_json, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (upd.error) throw upd.error;
  return upd.data[0]||null;
}
async function deleteAutomation(id){
  const supa = requireSupa();
  const del = await supa.from('automations').delete().eq('id', id);
  if (del.error) throw del.error;
  return { success:true };
}

// Invoices / Subscriptions
async function createInvoice({ invoice_id, workspace, plan, amount, currency }){
  const supa = requireSupa();
  const ins = await supa.from('invoices').insert({ invoice_id, workspace, plan, amount, currency, status:'pending' }).select();
  if (ins.error) throw ins.error;
  return ins.data[0];
}
async function getInvoiceByInvoiceId(invoice_id){
  const supa = requireSupa();
  const res = await supa.from('invoices').select('*').eq('invoice_id', invoice_id).limit(1);
  if (res.error) throw res.error;
  return res.data[0]||null;
}
async function listInvoices(limit=100){
  const supa = requireSupa();
  const res = await supa.from('invoices').select('*').order('created_at',{ascending:false}).limit(limit);
  if (res.error) throw res.error;
  return res.data;
}
async function markInvoicePaid(invoice_id){
  const supa = requireSupa();
  const upd = await supa.from('invoices').update({ status:'paid' }).eq('invoice_id', invoice_id);
  if (upd.error) throw upd.error;
  return getInvoiceByInvoiceId(invoice_id);
}
async function createSubscription({ workspace, plan, months=1 }){
  const supa = requireSupa();
  const started = new Date();
  const expires = new Date(Date.now() + months*30*24*60*60*1000);
  const ins = await supa.from('subscriptions').insert({ workspace, plan, status:'active', started_at: started.toISOString(), expires_at: expires.toISOString() }).select();
  if (ins.error) throw ins.error;
  return ins.data[0];
}
async function getSubscriptionByWorkspace(workspace){
  const supa = requireSupa();
  const res = await supa.from('subscriptions').select('*').eq('workspace', workspace).order('id',{ascending:false}).limit(1);
  if (res.error) throw res.error;
  return res.data[0]||null;
}

// Analytics
async function getTotals(){
  const supa = requireSupa();
  const inboundRes = await supa.from('messages').select('id', { count:'exact', head:true }).eq('direction','in');
  const outboundRes = await supa.from('messages').select('id', { count:'exact', head:true }).eq('direction','out');
  if (inboundRes.error) throw inboundRes.error;
  if (outboundRes.error) throw outboundRes.error;
  return { in: inboundRes.count || 0, out: outboundRes.count || 0 };
}
async function getCountsByDay(days=14){
  const supa = requireSupa();
  const since = new Date(Date.now() - days*24*60*60*1000).toISOString();
  const res = await supa.from('messages').select('created_at,direction').gte('created_at', since);
  if (res.error) throw res.error;
  const bucket = {};
  for (const r of res.data){
    const day = r.created_at.slice(0,10);
    if (!bucket[day]) bucket[day] = { in:0, out:0 };
    bucket[day][r.direction]++;
  }
  return Object.entries(bucket).sort(([a],[b])=> a.localeCompare(b)).map(([date, counts]) => ({ date, in: counts.in, out: counts.out }));
}
async function getTopContacts(limit=5){
  const supa = requireSupa();
  const res = await supa.from('messages').select('from_number,to_number,direction');
  if (res.error) throw res.error;
  const tally = {};
  for (const m of res.data){
    const peer = m.direction==='in' ? m.from_number : m.to_number;
    tally[peer] = (tally[peer]||0) + 1;
  }
  return Object.entries(tally).sort((a,b)=> b[1]-a[1]).slice(0,limit).map(([peer,count])=>({peer,count}));
}

module.exports = {
  ensureWorkspaceForUser,
  saveMessage,
  getMessages,
  upsertContact,
  createTemplate, listTemplates, getTemplateById, updateTemplate, deleteTemplate,
  createAutomation, listAutomations, getAutomationById, updateAutomation, deleteAutomation,
  createInvoice, getInvoiceByInvoiceId, listInvoices, markInvoicePaid, createSubscription, getSubscriptionByWorkspace,
  getTotals, getCountsByDay, getTopContacts,
  ensureConversation: async (peer)=>{
    const supa = requireSupa();
    const found = await supa.from('conversations').select('*').eq('peer', peer).limit(1);
    if (found.error) throw found.error;
    if (found.data.length) return found.data[0];
    const ins = await supa.from('conversations').insert({ peer }).select();
    if (ins.error) throw ins.error;
    return ins.data[0];
  },
  listConversations: async (limit=200, filter='all', userId=null)=>{
    const supa = requireSupa();
    const msgs = await supa.from('messages').select('from_number,to_number,created_at,direction');
    if (msgs.error) throw msgs.error;
    const peers = new Map();
    for (const m of msgs.data){
      const p = m.direction==='in' ? m.from_number : m.to_number;
      const t = Date.parse(m.created_at);
      peers.set(p, Math.max(peers.get(p)||0, t));
    }
    const convRows = await supa.from('conversations').select('*');
    if (convRows.error) throw convRows.error;
    const convMap = new Map(convRows.data.map(r=>[r.peer, r]));
    let items = Array.from(peers.entries()).map(([peer, ts])=> ({ peer, last_time: new Date(ts).toISOString(), assigned_user_id: convMap.get(peer)?.assigned_user_id || null }));
    items.sort((a,b)=> Date.parse(b.last_time)-Date.parse(a.last_time));
    items = items.filter(r => {
      if (filter==='mine') return r.assigned_user_id===userId;
      if (filter==='unassigned') return !r.assigned_user_id;
      return true;
    });
    return items.slice(0, limit);
  },
  assignConversation: async (peer, userId)=>{
    const supa = requireSupa();
    const upd = await supa.from('conversations').upsert({ peer, assigned_user_id: userId, assigned_at: new Date().toISOString() }).select();
    if (upd.error) throw upd.error;
    return upd.data[0];
  },
  unassignConversation: async (peer)=>{
    const supa = requireSupa();
    const upd = await supa.from('conversations').update({ assigned_user_id: null, assigned_at: null }).eq('peer', peer).select();
    if (upd.error) throw upd.error;
    return upd.data[0];
  }
};

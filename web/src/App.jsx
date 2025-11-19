import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { io as ioClient } from 'socket.io-client';
import { MessageCircle, Settings, Zap, FileText, CreditCard } from 'lucide-react';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { useI18n } from './i18n';
import { apiFetch, getToken, setToken, clearToken, setWorkspace, setUser, getUser } from './api';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Login />} />
        <Route path='/dashboard' element={<DashboardLayout />} />
        <Route path='/messages' element={<DashboardLayout page={<Messages />} />} />
        <Route path='/onboarding' element={<DashboardLayout page={<Onboarding />} />} />
        <Route path='/admin' element={<DashboardLayout page={<AdminPanel />} />} />
        <Route path='/automations' element={<DashboardLayout page={<Automations />} />} />
        <Route path='/templates' element={<DashboardLayout page={<Templates />} />} />
        <Route path='/billing' element={<DashboardLayout page={<Billing />} />} />
      </Routes>
    </Router>
  );
}

function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'reset'

  return (
    <div className='login-screen'>
      <div className='login-card'>
        <h1>{t('appTitle')}</h1>
        <input placeholder={t('email')} value={email} onChange={e=>setEmail(e.target.value)} />
        {(mode==='login' || mode==='signup' || mode==='reset') && (
          <input type='password' placeholder={t('password')} value={password} onChange={e=>setPassword(e.target.value)} />
        )}
        {error && <div style={{color:'#b00', marginBottom:8}}>{error}</div>}
        <button onClick={async ()=>{
          try {
            const path = mode==='signup' ? '/api/auth/signup' : '/api/auth/login';
            if (mode==='forgot') {
              await apiFetch('/api/auth/forgot', { method:'POST', body: JSON.stringify({ email }) });
              setError('If the account exists, a reset code was generated.');
              return;
            } else if (mode==='reset') {
              const code = prompt('Enter reset code');
              const r = await apiFetch('/api/auth/reset', { method:'POST', body: JSON.stringify({ email, code, newPassword: password }) });
              const d = await r.json();
              if (!r.ok) throw new Error(d?.error||'Reset failed');
              setMode('login');
              setError('Password reset. Please login.');
              return;
            }
            const r = await apiFetch(path, { method:'POST', body: JSON.stringify({ email, password }) });
            const d = await r.json();
            if (!r.ok) throw new Error(d?.error||'Login failed');
            setToken(d.token);
            setUser(d.user);
            setWorkspace(d.workspace);
            navigate('/dashboard');
          } catch (e) { setError(e.message); }
        }}>{mode==='signup' ? 'Sign up' : mode==='forgot' ? 'Send reset link' : mode==='reset' ? 'Set new password' : t('login')}</button>
        <div style={{display:'flex', gap:12, marginTop:10, fontSize:12}}>
          <button type='button' onClick={()=>setMode(mode==='signup'?'login':'signup')} style={{all:'unset', color:'#2563eb', cursor:'pointer'}}> {mode==='signup'?'Have an account? Login':'Create an account'} </button>
          <button type='button' onClick={()=>setMode('forgot')} style={{all:'unset', color:'#2563eb', cursor:'pointer'}}>Forgot password?</button>
          <button type='button' onClick={()=>setMode('reset')} style={{all:'unset', color:'#2563eb', cursor:'pointer'}}>Have code? Reset</button>
        </div>
      </div>
    </div>
  );
}

function DashboardLayout({ page }) {
  const nav = useNavigate();
  useEffect(()=>{
    if (!getToken()) nav('/');
  }, []);
  return (
    <div className='app-shell'>
      <Sidebar />
      <main className='main-area'>{page || <DashboardHome />}</main>
    </div>
  )
}

function Sidebar() {
  const { t, lang, setLang } = useI18n();
  return (
    <aside className='sidebar'>
      <div className='brand'>
        <img src="/logo.png" alt={t('brand')} onError={e=>{ e.currentTarget.style.display='none'; }} />
        {t('brand')}
      </div>
      <nav>
        <SidebarLink to='/dashboard' label={t('dashboard')} icon={<Settings size={16} />} />
        <SidebarLink to='/messages' label={t('messages')} icon={<MessageCircle size={16} />} />
        <SidebarLink to='/automations' label={t('automations')} icon={<Zap size={16} />} />
        <SidebarLink to='/templates' label={t('templates')} icon={<FileText size={16} />} />
        <SidebarLink to='/billing' label={t('billing')} icon={<CreditCard size={16} />} />
      </nav>
      <div style={{marginTop:12}}>
        <select value={lang} onChange={e=>setLang(e.target.value)} style={{width:'100%'}}>
          <option value='en'>English</option>
          <option value='es'>Español</option>
        </select>
        <button style={{marginTop:8, width:'100%'}} onClick={()=>{ clearToken(); window.location.href='/'; }}>Logout</button>
      </div>
    </aside>
  );
}

function SidebarLink({ to, label, icon }) {
  return (
    <Link to={to} className='sidebar-link'>
      <span className='icon'>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function DashboardHome() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(()=>{
    (async ()=>{
      try {
        const r = await apiFetch(`/api/analytics/overview`);
        const d = await r.json();
        setData(d);
        setErr('');
      } catch (e){ setErr('Failed to load analytics'); }
    })();
  }, []);

  const maxVal = useMemo(()=> (data?.byDay?.reduce((m, d)=> Math.max(m, d.in, d.out), 0) || 1), [data]);

  return (
    <div className='page'>
      <h1>{t('welcomeTitle')}</h1>
      <div className='card hero' style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
        <img src='/logo.png' alt={t('brand')} className='hero-logo' onError={e=>{ e.currentTarget.style.display='none'; }} />
        <div style={{opacity:0.75}}>{t('welcomeCopy')}</div>
      </div>
      {err && <div className='card' style={{color:'#b00'}}>{err}</div>}
      {data && (
        <>
          <div style={{display:'flex', gap:12}}>
            <div className='card' style={{flex:1}}>
              <div style={{opacity:0.7}}>{t('inbound')}</div>
              <div style={{fontSize:28, fontWeight:800}}>{data.totals?.in ?? 0}</div>
            </div>
            <div className='card' style={{flex:1}}>
              <div style={{opacity:0.7}}>{t('outbound')}</div>
              <div style={{fontSize:28, fontWeight:800}}>{data.totals?.out ?? 0}</div>
            </div>
            <div className='card' style={{flex:1}}>
              <div style={{opacity:0.7}}>{t('topContacts')}</div>
              <div>{(data.topContacts||[]).map(tc=> (<div key={tc.peer}>{tc.peer}: {tc.count}</div>))}</div>
            </div>
          </div>
          <div className='card' style={{marginTop:12}}>
            <div style={{fontWeight:700, marginBottom:8}}>{t('last14Days')}</div>
            <div style={{display:'flex', gap:8, alignItems:'flex-end', height:160}}>
              {(data.byDay||[]).map(d=> (
                <div key={d.date} title={d.date} style={{display:'flex', flexDirection:'column', alignItems:'center', width:18}}>
                  <div style={{height: Math.max(2, (d.out/maxVal)*120), width:12, background:'#4f46e5', borderRadius:4}}></div>
                  <div style={{height: Math.max(2, (d.in/maxVal)*120), width:12, background:'#06b6d4', borderRadius:4, marginTop:2}}></div>
                  <div style={{fontSize:10, opacity:0.6, marginTop:4}}>{new Date(d.date).toLocaleDateString(undefined, { month:'numeric', day:'numeric'})}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:12, marginTop:8, fontSize:12, opacity:0.7}}>
              <div style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:12,height:12,background:'#4f46e5',display:'inline-block',borderRadius:3}}></span> Out</div>
              <div style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:12,height:12,background:'#06b6d4',display:'inline-block',borderRadius:3}}></span> In</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Messages() {
  const { t } = useI18n();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [composeTo, setComposeTo] = useState('');
  const [composeText, setComposeText] = useState('');
  const [session, setSession] = useState({ connected: false, qr: null });
  const API = useMemo(() => (window.__API_URL__) || 'http://localhost:3333', []);
  const chatRef = useRef(null);

  async function loadMessages() {
    try {
      setLoading(true);
      const params = selected ? `?peer=${encodeURIComponent(selected)}` : '';
      const res = await apiFetch(`/api/messages${params}`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  async function loadSession() {
    try {
      const res = await fetch(`${API}/api/session`);
      const data = await res.json();
      setSession(data);
    } catch {}
  }

  async function loadConversations(){
    try{
      const r = await apiFetch(`/api/conversations?filter=${encodeURIComponent(filter)}`);
      const d = await r.json();
      setThreads(d.map(row=> ({ peer: row.peer, msgs: [], last: { created_at: row.last_time } })));
    } catch {}
  }

  useEffect(() => {
    loadMessages();
    loadSession();
    loadConversations();
    // Poll as a fallback every 30s
    const iv = setInterval(() => { loadMessages(); loadSession(); }, 30000);
    // Realtime socket
    const base = (import.meta?.env?.VITE_API_BASE_URL) || (window.__API_URL__) || 'http://localhost:3333';
    const socket = ioClient(base, { transports: ['websocket'], auth: { token: getToken() } });
    socket.on('connect', ()=>{});
    socket.on('wa:status', (st)=> setSession(st));
    socket.on('message:new', (evt)=> {
      // If the event relates to the active peer, just refresh thread; else refresh summary list
      if (!selected || evt.peer===selected) {
        loadMessages();
      }
      loadConversations();
    });
    return () => { clearInterval(iv); socket.close(); };
  }, []);

  useEffect(() => { if (selected) loadMessages(); }, [selected]);

  useEffect(()=>{
    // auto-scroll to bottom of chat when messages for active thread change
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [activeThread?.msgs?.length]);

  const [threads, setThreads] = useState([]);
  useEffect(()=>{ loadConversations(); }, [filter]);

  useEffect(()=>{
    if (!selected && threads.length) setSelected(threads[0].peer);
  }, [threads, selected]);

  const activeThread = useMemo(()=> threads.find(t=>t.peer===selected), [threads, selected]);

  async function sendMessage(ev) {
    ev?.preventDefault();
    const to = selected || composeTo;
    const text = composeText.trim();
    if (!to || !text) return;
    try {
      const res = await apiFetch(`/api/send`, {
        method: 'POST',
        headers: { },
        body: JSON.stringify({ to, text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Send failed');
      setComposeText('');
      setComposeTo('');
      await loadMessages();
    } catch (e) {
      setError(e.message || 'Failed to send');
    }
  }

  return (
    <div className='page'>
      <h1>{t('messages')}</h1>
      {!session.connected && (
        <div className='card'>
          <strong>{t('notConnected')}</strong>
          <div style={{marginTop:8}}>{t('scanQrHint')}</div>
        </div>
      )}
      <div className='card' style={{display:'flex', gap:12, minHeight:360}}>
        <div style={{width:260, borderRight:'1px solid #eee', paddingRight:8}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <div style={{fontWeight:700}}>{t('inbox')}</div>
              <select value={filter} onChange={e=>setFilter(e.target.value)}>
                <option value='all'>All</option>
                <option value='mine'>Mine</option>
                <option value='unassigned'>Unassigned</option>
              </select>
            </div>
          {loading && <div>Loading…</div>}
          {error && <div style={{color:'#b00'}}>{error}</div>}
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {threads.map(t=> (
              <button key={t.peer} onClick={()=>setSelected(t.peer)}
                className='sidebar-link'
                style={{display:'flex', justifyContent:'space-between'}}>
                <span>{t.peer}</span>
                <span style={{opacity:0.6, fontSize:12}}>{t.last?.created_at ? new Date(t.last.created_at).toLocaleTimeString() : ''}</span>
              </button>
            ))}
            {threads.length===0 && <div style={{opacity:0.7}}>{t('noMessages')}</div>}
          </div>
        </div>
        <div style={{flex:1, display:'flex', flexDirection:'column'}}>
          <div style={{borderBottom:'1px solid #eee', paddingBottom:8, marginBottom:8, fontWeight:700, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>{selected || 'New message'}</div>
            {selected && (
              <div style={{display:'flex', gap:8}}>
                <button onClick={async()=>{ await apiFetch('/api/conversations/assign', { method:'POST', body: JSON.stringify({ peer: selected }) }); loadConversations(); }}>Assign to me</button>
                <button onClick={async()=>{ await apiFetch('/api/conversations/unassign', { method:'POST', body: JSON.stringify({ peer: selected }) }); loadConversations(); }}>Unassign</button>
              </div>
            )}
          </div>
          <div style={{flex:1, overflow:'auto', display:'flex', flexDirection:'column', gap:8}}>
            {activeThread?.msgs?.map(m => (
              <div key={m.id} style={{alignSelf: m.direction==='out'?'flex-end':'flex-start', maxWidth:'70%'}}>
                <div style={{
                  background: m.direction==='out' ? '#dfefff' : '#f1f5f7',
                  border:'1px solid #e2e8f0', padding:'8px 10px', borderRadius:8
                }}>{m.text}</div>
                <div style={{fontSize:11, opacity:0.6, marginTop:2}}>{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
            {!activeThread && (
              <div style={{opacity:0.7}}>Select a conversation or compose a new message.</div>
            )}
          </div>
          <form onSubmit={sendMessage} style={{display:'flex', gap:8, marginTop:8}}>
            {!selected && (
              <input placeholder={t('composeRecipient')} value={composeTo} onChange={e=>setComposeTo(e.target.value)} style={{flexBasis:280}} />
            )}
            <textarea placeholder={t('composePlaceholder')} value={composeText}
              onKeyDown={e=>{ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); } }}
              onChange={e=>setComposeText(e.target.value)} style={{flex:1, minHeight:44, resize:'vertical'}} />
            <button type='submit'>{t('send')}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Onboarding(){
  const { t } = useI18n();
  const [session, setSession] = useState({ connected:false, qr:null });
  const API = useMemo(() => (import.meta?.env?.VITE_API_BASE_URL) || (window.__API_URL__) || 'http://localhost:3333', []);
  useEffect(()=>{
    const fetchSession = async ()=>{
      try{ const r = await fetch(`${API}/api/session`); const d = await r.json(); setSession(d);} catch {}
    };
    fetchSession();
    const s = ioClient(API, { transports:['websocket'] });
    s.on('wa:status', st=> setSession(st));
    const iv = setInterval(fetchSession, 15000);
    return ()=>{ s.close(); clearInterval(iv); };
  }, [API]);
  return (
    <div className='page'>
      <h1>Onboarding</h1>
      <div className='card' style={{display:'flex', gap:16}}>
        <div style={{flex:1}}>
          <h3>Connect WhatsApp</h3>
          {!session.connected && session.qr && (
            <img alt='Scan QR' src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(session.qr)}`} />
          )}
          {!session.connected && !session.qr && (<div>{t('scanQrHint')}</div>)}
          {session.connected && (<div><strong>Connected!</strong> You can start messaging.</div>)}
        </div>
        <div style={{flex:1}}>
          <h3>Next Steps</h3>
          <ol>
            <li>Scan the QR code with your WhatsApp.</li>
            <li>Keep this tab open until the status shows Connected.</li>
            <li>Head to Messages to test inbound/outbound.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function AdminPanel(){
  const [invoices, setInvoices] = useState([]);
  const [sub, setSub] = useState(null);
  const [err, setErr] = useState('');
  useEffect(()=>{
    (async ()=>{
      try{
        const r = await apiFetch('/api/billing/invoices');
        const d = await r.json(); setInvoices(Array.isArray(d)?d:[]);
        setErr('');
      } catch(e){ setErr('Failed to load invoices'); }
    })();
  },[]);
  return (
    <div className='page'>
      <h1>Admin</h1>
      {err && <div className='card' style={{color:'#b00'}}>{err}</div>}
      <div className='card'>
        <h3>Invoices</h3>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {invoices.map(inv=> (
            <div key={inv.id} style={{display:'flex', gap:12}}>
              <div style={{flex:1}}>{inv.invoice_id}</div>
              <div>{inv.workspace}</div>
              <div>{inv.plan}</div>
              <div>${inv.amount} {inv.currency}</div>
              <div>{inv.status}</div>
            </div>
          ))}
          {invoices.length===0 && <div style={{opacity:0.7}}>No invoices</div>}
        </div>
      </div>
    </div>
  );
}

function Automations() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState({ id:null, name:'New Flow', steps:[] });
  // React Flow setup
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const rfStyle = { width:'100%', height:420, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8 };

  async function load() {
    try {
      setLoading(true);
      const r = await apiFetch(`/api/automations`);
      const d = await r.json();
      setList(Array.isArray(d)? d : []);
      setError('');
    } catch (e) { setError('Failed to load automations'); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ load(); }, []);

  function addNode(type='trigger_contains'){
    const id = crypto.randomUUID();
    const label = type.replace('_',' ');
    setNodes(ns=> [...ns, { id, position:{ x:100+ns.length*40, y:80+ns.length*20 }, data:{ label, type }, style:{ padding:8, border:'1px solid #cbd5e1', borderRadius:6, background:'#fff' } }]);
    if (nodes.length>0) {
      const prev = nodes[nodes.length-1]?.id;
      if (prev) setEdges(es=> [...es, { id: crypto.randomUUID(), source: prev, target: id }]);
    }
  }

  function removeSelected(){
    if (!nodes.length) return;
    setNodes(ns=> ns.slice(0, -1));
    setEdges(es=> es.filter((_,i)=> i < es.length-1));
  }

  async function saveFlow(){
    try {
      const payload = { name: current.name, flow_json: { nodes, edges } };
      if (current.id) {
        const r = await apiFetch(`/api/automations/${current.id}`, { method:'PUT', body: JSON.stringify(payload) });
        if (!r.ok) throw new Error('Update failed');
      } else {
        const r = await apiFetch(`/api/automations`, { method:'POST', body: JSON.stringify(payload) });
        if (!r.ok) throw new Error('Create failed');
        const d = await r.json();
        setCurrent(c=> ({...c, id: d.id}));
      }
      await load();
    } catch (e){ setError(e.message); }
  }

  async function selectFlow(a){
    setCurrent({ id: a.id, name: a.name, steps: [] });
    setNodes(a.flow_json?.nodes || []);
    setEdges(a.flow_json?.edges || []);
  }

  async function removeFlow(id){
    if (!confirm('Delete this automation?')) return;
    await apiFetch(`/api/automations/${id}`, { method:'DELETE' });
    if (current.id===id) setCurrent({ id:null, name:'New Flow', steps:[] });
    await load();
  }

  return (
    <div className='page'>
      <h1>Automations</h1>
      <div className='card' style={{display:'flex', gap:12}}>
        <div style={{width:280}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div style={{fontWeight:700}}>Flows</div>
            <button onClick={()=>setCurrent({ id:null, name:'New Flow', steps:[] })}>New</button>
          </div>
          {loading && <div>Loading…</div>}
          {error && <div style={{color:'#b00'}}>{error}</div>}
          <div style={{display:'flex', flexDirection:'column', gap:6, marginTop:8}}>
            {list.map(a=> (
              <div key={a.id} className='sidebar-link' style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <button onClick={()=>selectFlow(a)} style={{all:'unset', cursor:'pointer', flex:1}}>{a.name}</button>
                <button onClick={()=>removeFlow(a.id)}>Delete</button>
              </div>
            ))}
            {list.length===0 && <div style={{opacity:0.7}}>No automations yet.</div>}
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <input value={current.name} onChange={e=>setCurrent(c=>({...c, name:e.target.value}))} style={{flex:1}} />
            <button onClick={saveFlow}>Save</button>
          </div>
          <div style={{marginTop:12, display:'flex', gap:8}}>
            <button onClick={()=>addNode('trigger_contains')}>+ Trigger: Text contains</button>
            <button onClick={()=>addNode('action_reply')}>+ Action: Send reply</button>
            <button onClick={()=>addNode('wait')}>+ Wait</button>
            <button onClick={removeSelected}>Remove last</button>
          </div>
          <div style={{marginTop:12}}>
            <ReactFlowProvider>
              <ReactFlow nodes={nodes} edges={edges} onNodesChange={setNodes} onEdgesChange={setEdges} fitView style={rfStyle} />
            </ReactFlowProvider>
          </div>
        </div>
      </div>
    </div>
  );
}

function Templates() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ id:null, name:'', category:'', content:'' });
  const API = (window.__API_URL__) || 'http://localhost:3333';

  async function load() {
    try {
      setLoading(true);
      const r = await apiFetch(`/api/templates`);
      const d = await r.json();
      setItems(Array.isArray(d)? d : []);
      setError('');
    } catch (e) {
      setError('Failed to load templates');
    } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); }, []);

  async function save(ev){
    ev?.preventDefault();
    try {
      const isEdit = !!form.id;
      const url = isEdit ? `/api/templates/${form.id}` : `/api/templates`;
      const method = isEdit ? 'PUT' : 'POST';
      const r = await apiFetch(url, { method, body: JSON.stringify({ name: form.name, category: form.category, content: form.content }) });
      if (!r.ok) throw new Error('Save failed');
      setForm({ id:null, name:'', category:'', content:'' });
      await load();
    } catch (e){ setError(e.message); }
  }

  async function remove(id){
    if (!confirm('Delete this template?')) return;
    await apiFetch(`/api/templates/${id}`, { method:'DELETE' });
    await load();
  }

  function edit(t){ setForm({ id:t.id, name:t.name, category:t.category||'', content:t.content }); }

  return (
    <div className='page'>
      <h1>{t('templatesTitle')}</h1>
      <div className='card'>
        <form onSubmit={save} style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <input placeholder={t('name')} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{flex:'1 1 180px'}} />
          <input placeholder={t('category')} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{flex:'1 1 180px'}} />
          <input placeholder={t('content')} value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} style={{flex:'3 1 380px'}} />
          <button type='submit'>{form.id ? t('update') : t('create')}</button>
          {form.id && <button type='button' onClick={()=>setForm({ id:null, name:'', category:'', content:'' })}>{t('cancel')}</button>}
        </form>
      </div>
      <div className='card'>
        {loading && <div>Loading…</div>}
        {error && <div style={{color:'#b00'}}>{error}</div>}
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {items.map(t=> (
            <div key={t.id} style={{display:'flex', gap:12, alignItems:'center'}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{t.name} {t.category ? <span style={{opacity:0.6}}>· {t.category}</span> : null}</div>
                <div style={{opacity:0.8}}>{t.content}</div>
              </div>
              <button onClick={()=>edit(t)}>{t('update')}</button>
              <button onClick={()=>remove(t.id)}>{t('delete')}</button>
            </div>
          ))}
          {items.length===0 && <div style={{opacity:0.7}}>{t('noTemplates')}</div>}
        </div>
      </div>
    </div>
  );
}

function Billing() {
  return (
    <div className='page'>
      <h1>Billing</h1>
      <div className='card'>
        <h3>Plans</h3>
        <div className='plans'>
          <div className='plan'>
            <h4>Starter</h4>
            <div className='price'>$29.99</div>
            <button>Subscribe</button>
          </div>
          <div className='plan'>
            <h4>Premium AI</h4>
            <div className='price'>$59.99</div>
            <button>Subscribe</button>
          </div>
          <div className='plan'>
            <h4>Business Suite</h4>
            <div className='price'>$195</div>
            <button>Subscribe</button>
          </div>
        </div>
      </div>
    </div>
  );
}

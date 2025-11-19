const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSupabase } = require('./supabase');
const { ensureWorkspaceForUser } = require('./data');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

async function registerOrLogin(email, password){
  const supa = getSupabase();
  if (!supa) throw new Error('Supabase not configured');
  const sel = await supa.from('users').select('*').eq('email', email).limit(1);
  if (sel.error) throw sel.error;
  let user;
  if (sel.data.length){
    user = sel.data[0];
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) throw new Error('Invalid credentials');
  } else {
    const hash = await bcrypt.hash(password, 10);
    const ins = await supa.from('users').insert({ email, password_hash: hash }).select();
    if (ins.error) throw ins.error;
    user = ins.data[0];
  }
  const ws = await ensureWorkspaceForUser(user);
  return { user, workspace: ws };
}

function signToken(user, workspace){
  const payload = { sub: user.id, email: user.email, ws: { id: workspace.id, slug: workspace.slug, name: workspace.name } };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next){
  const hdr = req.headers['authorization'] || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.sub, email: decoded.email };
    req.workspace = decoded.ws;
    next();
  } catch (e){
    return res.status(401).json({ error: 'invalid token' });
  }
}

module.exports = { registerOrLogin, signToken, authMiddleware };

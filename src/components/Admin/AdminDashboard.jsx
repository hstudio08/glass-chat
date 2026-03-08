import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { motion } from 'framer-motion';
import { Users, Activity, ShieldAlert, Ban, Search, Mail, Phone, Trash2, Lock, ShieldCheck, Unlock, Crown } from 'lucide-react';

const SUPER_ADMIN_EMAIL = 'hstudio.webdev@gmail.com'; // 🛡️ The untouchable account

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // REAL-TIME FETCH
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('lastLogin', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      setUsers(usersData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 🛡️ ADMIN GOD ACTIONS (With Safeguards)
  const handleToggleBlock = async (user) => {
    if (user.email === SUPER_ADMIN_EMAIL) {
      alert("Action Denied: You cannot block the Master Admin account.");
      return;
    }

    if (window.confirm(`Are you sure you want to ${user.isBlocked ? 'UNBLOCK' : 'BLOCK'} this user?`)) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { isBlocked: !user.isBlocked });
      } catch (err) { alert("Failed to update user status."); }
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.email === SUPER_ADMIN_EMAIL) {
      alert("Action Denied: You cannot delete the Master Admin account.");
      return;
    }

    if (window.confirm("WARNING: This will permanently delete this user from the database. Proceed?")) {
      try {
        await deleteDoc(doc(db, 'users', user.uid));
      } catch (err) { alert("Failed to delete user."); }
    }
  };

  const totalUsers = users.length;
  const blockedUsers = users.filter(u => u.isBlocked).length;
  
  const filteredUsers = users.filter(user => 
    (user.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.phone || '').includes(searchQuery)
  );

  const formatTime = (ts) => {
    if (!ts) return "Never";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/10 relative z-10 p-4 md:p-8">
      <div className="shrink-0 flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-chatly-dark mb-2 flex items-center gap-3"><ShieldAlert className="text-chatly-maroon" size={36} /> Master Control</h1>
          <p className="text-[15px] font-bold text-chatly-dark/60">Monitor, moderate, and manage your user base.</p>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-chatly-peach to-[#e6c1c1] flex items-center justify-center text-chatly-maroon shadow-inner"><Users size={24} /></div>
          <div><p className="text-sm font-extrabold text-chatly-dark/60 uppercase tracking-widest mb-1">Total Users</p><h2 className="text-3xl font-extrabold text-chatly-dark">{isLoading ? '-' : totalUsers}</h2></div>
        </div>
        <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center text-chatly-green shadow-inner"><Activity size={24} /></div>
          <div><p className="text-sm font-extrabold text-chatly-dark/60 uppercase tracking-widest mb-1">Active Accounts</p><h2 className="text-3xl font-extrabold text-chatly-dark">{isLoading ? '-' : totalUsers - blockedUsers}</h2></div>
        </div>
        <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center text-red-600 shadow-inner"><Ban size={24} /></div>
          <div><p className="text-sm font-extrabold text-chatly-dark/60 uppercase tracking-widest mb-1">Blocked Users</p><h2 className="text-3xl font-extrabold text-chatly-dark">{isLoading ? '-' : blockedUsers}</h2></div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-white/50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/20">
          <div className="flex items-center w-full max-w-md bg-white/50 border border-white/80 rounded-full px-4 py-3 focus-within:bg-white/80 transition-all shadow-sm">
            <Search className="text-chatly-maroon shrink-0" size={18} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search users by name, email, or phone..." className="flex-1 bg-transparent border-none outline-none ml-3 text-chatly-dark font-bold text-[15px] placeholder-chatly-dark/50" />
          </div>
        </div>

        <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-4 bg-[#fdf2f0]/60 border-b border-white/50 text-xs font-extrabold text-chatly-dark/50 uppercase tracking-widest">
          <div className="col-span-3">User Profile</div><div className="col-span-3">Contact Detail</div><div className="col-span-2">Last Seen</div><div className="col-span-2">Status</div><div className="col-span-2 text-right">Admin Actions</div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-4">
          {isLoading ? ( <div className="flex items-center justify-center h-full text-chatly-dark font-bold">Loading...</div> ) : filteredUsers.length === 0 ? ( <div className="flex items-center justify-center h-full text-chatly-dark font-bold">No users found.</div> ) : (
            filteredUsers.map((user, idx) => {
              const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

              return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={user.uid} className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-4 md:px-6 py-4 items-center border border-white/40 hover:bg-white/60 transition-colors rounded-3xl md:rounded-2xl mx-2 mb-3 shadow-sm ${user.isBlocked ? 'bg-red-50/40' : 'bg-white/40'}`}>
                  <div className="col-span-1 md:col-span-3 flex items-center gap-4">
                    <img src={user.avatar || "https://i.pravatar.cc/150?img=placeholder"} className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover" alt="avatar" />
                    <div className="min-w-0"><h4 className="font-extrabold text-chatly-dark text-[15px] truncate">{user.name || "Unknown User"}</h4><p className="text-xs font-bold text-chatly-dark/50 truncate w-32">{user.uid}</p></div>
                  </div>
                  
                  <div className="col-span-1 md:col-span-3 flex flex-col justify-center">
                    {user.email && user.email !== "No Email" && <div className="flex items-center gap-2 text-[13px] font-bold text-chatly-dark/80 truncate"><Mail size={14} className="text-chatly-maroon shrink-0" /> {user.email}</div>}
                    {user.phone && user.phone !== "No Phone" && <div className="flex items-center gap-2 text-[13px] font-bold text-chatly-dark/80 mt-1"><Phone size={14} className="text-chatly-maroon shrink-0" /> {user.phone}</div>}
                  </div>
                  
                  <div className="col-span-1 md:col-span-2 flex items-center"><span className="text-[13px] font-bold text-chatly-dark/80 bg-white/60 px-3 py-1.5 rounded-xl border border-white/80 shadow-sm">{formatTime(user.lastLogin)}</span></div>
                  
                  <div className="col-span-1 md:col-span-2 flex items-center">
                    {isSuperAdmin ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-extrabold bg-yellow-100 text-yellow-700 shadow-sm border border-yellow-200"><Crown size={14} /> Owner</span>
                    ) : user.isBlocked ? ( 
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-extrabold bg-red-100 text-red-700 shadow-sm border border-red-200"><Lock size={14} /> Banned</span> 
                    ) : ( 
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-extrabold bg-green-100 text-green-700 shadow-sm border border-green-200"><ShieldCheck size={14} /> Active</span> 
                    )}
                  </div>
                  
                  <div className="col-span-1 md:col-span-2 flex items-center justify-end gap-2 mt-4 md:mt-0 pt-4 md:pt-0 border-t border-white/50 md:border-none">
                    {/* 🛡️ Hide action buttons if the row belongs to the Super Admin */}
                    {isSuperAdmin ? (
                      <span className="text-[11px] font-extrabold text-chatly-dark/40 uppercase tracking-widest px-2">Protected</span>
                    ) : (
                      <>
                        <button onClick={() => handleToggleBlock(user)} className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm transition-transform hover:scale-105 flex items-center gap-1.5 ${user.isBlocked ? 'bg-chatly-dark text-white' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                          {user.isBlocked ? <><Unlock size={14}/> Unblock</> : <><Ban size={14}/> Block</>}
                        </button>
                        <button onClick={() => handleDeleteUser(user)} className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors shadow-sm"><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
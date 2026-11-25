(()=>{'use strict';if(window.top!==window)return;
const bar=document.createElement('div');bar.className='sieg-account-strip';bar.setAttribute('aria-label','SIEG account');
const link=document.createElement('a');link.textContent='Sign in';link.href='/login?return_to='+encodeURIComponent(location.pathname+location.search);bar.append(link);
const head=document.querySelector('header');if(head)head.after(bar);else document.body.prepend(bar);
fetch('/api/account',{credentials:'same-origin',headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(account=>{if(!account)return;if(account.authenticated){link.textContent='Sign out';link.href='/logout';if(account.isAdmin){const admin=document.createElement('a');admin.textContent='Launch checks';admin.href='/admin/launch';bar.prepend(admin)}}}).catch(()=>{});
})();

import {t} from './i18n.mjs';
// Installation does not cache orders, customer details or private images.
let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{installPrompt=null;});
if('serviceWorker' in navigator && !window.LHF_NATIVE_APP){
 window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{}));
}
function closeDialog(dialog,previous){dialog.close();dialog.remove();window.removeEventListener('lhf:languagechange',dialog.refreshLanguage);previous?.focus();}
document.addEventListener('click',async event=>{
 const target=event.target.closest('#install-app');if(!target)return;
 if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();return;}
 const old=document.querySelector('#app-install-dialog');if(old)return old.showModal();
 const dialog=document.createElement('dialog');dialog.id='app-install-dialog';dialog.className='app-install-dialog';dialog.setAttribute('aria-labelledby','app-install-title');
 const heading=document.createElement('h2');heading.id='app-install-title';
 const intro=document.createElement('p');
 const instructions=document.createElement('p');
 const note=document.createElement('p');note.className='install-local-note';
 const close=document.createElement('button');close.type='button';close.addEventListener('click',()=>closeDialog(dialog,target));
 dialog.refreshLanguage=()=>{
  heading.textContent=t('A little space of your own.');
  intro.textContent=t(window.LHF_NATIVE_APP?'You’re using the Little House Flower desktop app. Your orders and studio tools share this computer’s local workspace.':'Open Little House Flower in its own window, with a dedicated app icon and no browser tabs.');
  instructions.textContent=t(window.LHF_NATIVE_APP?'Keep this app in your Dock for easy access.':'On Mac, open the included Little House Flower app. In Safari, you can also choose File → Add to Dock. Other supported browsers offer Install app in their address bar or menu.');
  note.textContent=t('Local preview · the workspace runs on this computer. Orders and payments are demonstration data until a live connection is explicitly approved.');
  close.textContent=t('Got it');
 };
 dialog.refreshLanguage();window.addEventListener('lhf:languagechange',dialog.refreshLanguage);
 dialog.append(heading,intro,instructions,note,close);document.body.append(dialog);dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog,target);});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog(dialog,target);}});dialog.showModal();close.focus();
});

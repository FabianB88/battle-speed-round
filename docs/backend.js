import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, doc, collection, getDoc, getDocFromServer, setDoc, runTransaction, serverTimestamp, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { firebaseConfig, adminUid } from './firebase-config.js';
const playerApp = initializeApp(firebaseConfig);
const hostApp = initializeApp(firebaseConfig, 'administrator');
export const playerAuth = getAuth(playerApp), adminAuth = getAuth(hostApp);
export const db = getFirestore(playerApp), hostDb = getFirestore(hostApp);
export { doc, collection, getDoc, onSnapshot, query, where };
function ready(auth) { return new Promise(resolve => { const off = onAuthStateChanged(auth, u => { off(); resolve(u); }); }); }
export async function initialize() {
  await Promise.all([ready(playerAuth), ready(adminAuth)]);
  if (!playerAuth.currentUser) await signInAnonymously(playerAuth);
}
export async function login(email, password) {
  const result = await signInWithEmailAndPassword(adminAuth, email, password);
  if (result.user.uid !== adminUid) { await signOut(adminAuth); throw new Error('Dit account heeft geen toegang tot beheer.'); }
}
export const isAdmin = () => adminAuth.currentUser?.uid === adminUid;
export const logout = () => signOut(adminAuth);
export async function changePassword(oldPassword, newPassword) {
  await reauthenticateWithCredential(adminAuth.currentUser, EmailAuthProvider.credential(adminAuth.currentUser.email, oldPassword));
  await updatePassword(adminAuth.currentUser, newPassword);
}
const emptyRound = number => ({ number, question:'', state:'waiting', count:0, winnerId:null, winnerName:null, winnerAt:null, startedAt:null, lastPressId:null });
export async function createRoom() {
  for(let attempt=0; attempt<5; attempt++) {
    const code = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
    const created = await runTransaction(hostDb, async tx => {
      const ref = doc(hostDb, 'rooms', code);
      if((await tx.get(ref)).exists()) return false;
      tx.set(ref, {ownerId:adminAuth.currentUser.uid,title:'Battle Speed Round',createdAt:serverTimestamp(),currentRound:1});
      tx.set(doc(hostDb,'rooms',code,'rounds','1'),emptyRound(1));
      return true;
    });
    if(created) return code;
  }
  throw new Error('Een kamer maken lukt nu niet. Probeer het opnieuw.');
}
export async function joinRoom(code, name) {
  const room = await getDoc(doc(db, 'rooms', code));
  if(!room.exists()) throw new Error('Deze kamercode bestaat niet. Controleer de code bij de beheerder.');
  const ref = doc(db,'rooms',code,'members',playerAuth.currentUser.uid);
  const member = await getDoc(ref);
  if(member.exists()) return member.data().name;
  await setDoc(ref, {name:name.trim(),joinedAt:serverTimestamp()});
  return name.trim();
}
export async function nextRound(code) {
  await runTransaction(hostDb, async tx => {
    const ref = doc(hostDb,'rooms',code), room=await tx.get(ref);
    const number = room.data().currentRound + 1;
    tx.update(ref,{currentRound:number});
    tx.set(doc(hostDb,'rooms',code,'rounds',String(number)),emptyRound(number));
  });
}
export async function setRoundState(code, number, state, question) {
  await runTransaction(hostDb, async tx => {
    const room = await tx.get(doc(hostDb,'rooms',code));
    const ref=doc(hostDb,'rooms',code,'rounds',String(number));
    const round=await tx.get(ref);
    let publishedQuestion=question;
    if(state==='open' && publishedQuestion===undefined) {
      const draft=await tx.get(doc(hostDb,'rooms',code,'drafts',String(number)));
      publishedQuestion=draft.exists()?draft.data().question:'';
    }
    if(room.data().currentRound !== number) throw new Error('De ronde is intussen gewijzigd.');
    if(state === 'open' && round.data().state !== 'waiting') throw new Error('Deze ronde is al gestart.');
    if(state === 'closed' && round.data().state !== 'open') throw new Error('Deze ronde is niet geopend.');
    tx.update(ref, state==='open'?{state,startedAt:serverTimestamp(),question:publishedQuestion.trim()}:{state});
  });
}
export async function saveQuestion(code,number,question) {
  await runTransaction(hostDb,async tx=>{
    const ref=doc(hostDb,'rooms',code,'rounds',String(number));
    const round=await tx.get(ref);
    if(round.data().state!=='waiting') throw new Error('Maak een nieuwe ronde om een nieuwe vraag klaar te zetten.');
    tx.set(doc(hostDb,'rooms',code,'drafts',String(number)),{question:question.trim(),updatedAt:serverTimestamp()});
  });
}
export async function press(code, number) {
  const uid = playerAuth.currentUser.uid;
  // Rules can reject a stale counter before the transaction conflict is retried.
  // Re-read the server to distinguish contention from an invalid or closed round.
  for(let attempt=0;attempt<12;attempt++) {
   try { return await runTransaction(db, async tx => {
    const room = await tx.get(doc(db,'rooms',code));
    const roundRef=doc(db,'rooms',code,'rounds',String(number));
    const round=await tx.get(roundRef);
    const pressRef=doc(db,'rooms',code,'rounds',String(number),'presses',uid);
    const existing=await tx.get(pressRef);
    const member=await tx.get(doc(db,'rooms',code,'members',uid));
    if(existing.exists()) return existing.data().rank;
    if(room.data().currentRound !== number || round.data().state!=='open') throw new Error('Deze ronde is nog niet gestart of al gesloten.');
    if(!member.exists()) throw new Error('Meld je eerst aan als deelnemer.');
    const rank=round.data().count+1, name=member.data().name;
    tx.set(pressRef,{playerId:uid,name,rank,pressedAt:serverTimestamp()});
    tx.update(roundRef,{count:rank,lastPressId:uid,...(rank===1?{winnerId:uid,winnerName:name,winnerAt:serverTimestamp()}:{})});
    return rank;
   },{maxAttempts:12}); }
   catch(error) {
    if(error.code!=='permission-denied' && error.code!=='aborted') throw error;
    const existing=await getDocFromServer(doc(db,'rooms',code,'rounds',String(number),'presses',uid));
    if(existing.exists()) return existing.data().rank;
    const room=await getDocFromServer(doc(db,'rooms',code));
    const round=await getDocFromServer(doc(db,'rooms',code,'rounds',String(number)));
    if(!room.exists()||!round.exists()||room.data().currentRound!==number||round.data().state!=='open') throw new Error('Deze ronde is nog niet gestart of al gesloten.');
    if(attempt===11) throw error;
    await new Promise(resolve=>setTimeout(resolve,25+Math.random()*Math.min(400,40*(attempt+1))));
   }
  }
}

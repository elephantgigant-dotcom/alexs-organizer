// Areas of life: users/{uid}/categories/{id} = { name, color (slot 1–8), order }

import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

const col = (uid) => collection(db, 'users', uid, 'categories')

export function watchCategories(uid, onChange) {
  return onSnapshot(query(col(uid), orderBy('order')), (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export function addCategory(uid, { name, color, order }) {
  return addDoc(col(uid), { name: name.trim(), color, order })
}

export function updateCategory(uid, id, data) {
  return updateDoc(doc(col(uid), id), data)
}

// Tasks keep the old id and simply show "No category"
export function deleteCategory(uid, id) {
  return deleteDoc(doc(col(uid), id))
}

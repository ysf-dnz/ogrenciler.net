// Yapılacak işler:
// 1. state.labels dizisine CRUD fonksiyonları
// 2. Etiket oluşturma/düzenleme/silme
// 3. Silme sırasında task.labels[] içindeki referansları temizle

export function addLabel(name, color) {
  const newLabel = { id: generateId(), name, color };
  state.labels.push(newLabel);
  saveStateAndRerender();
}

export function updateLabel(id, { name, color }) {
  const label = state.labels.find(l => l.id === id);
  if (!label) return;
  if (name) label.name = name;
  if (color) label.color = color;
  saveStateAndRerender();
}

export function deleteLabel(id) {
  state.labels = state.labels.filter(l => l.id !== id);
  // Görevlerdeki referansları temizle:
  state.tasks.forEach(t => {
    t.labels = (t.labels || []).filter(lid => lid !== id);
  });
  saveStateAndRerender();
}

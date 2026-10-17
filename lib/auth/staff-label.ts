// For the users screens: the name to show, and whether the login is worth showing beside it.
export function staffLabel(user: { name?: string | null; username: string }): { name: string; showLogin: boolean } {
  const name = user.name?.trim() || user.username;
  return { name, showLogin: name !== user.username };
}

// Person-picker text per login: the display name, or "Name (login)" when another login shares it.
export function staffPickerLabels(users: { name?: string | null; username: string }[]): Map<string, string> {
  const names = users.map(u => staffLabel(u).name);
  return new Map(users.map((u, i) => [
    u.username, names.filter(n => n === names[i]).length > 1 ? `${names[i]} (${u.username})` : names[i],
  ]));
}

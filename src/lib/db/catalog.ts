export function getCatalogNameKey(name: string) {
	return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

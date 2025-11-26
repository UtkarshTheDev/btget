export default function group(iterable: Buffer, groupSize: number): Buffer[] {
	const groups: Buffer[] = [];
	for (let i = 0; i < iterable.length; i += groupSize) {
		groups.push(iterable.slice(i, i + groupSize));
	}
	return groups;
}

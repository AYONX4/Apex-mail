const addressesToUpsert = new Map()
const email = {
    from: { address: 'elliott@useincubate.com', name: 'Elliott Chong' },
    to: [{ address: 'gmansoor@technologyrivers.com', name: 'Ghazenfer Mansoor' }],
    cc: [],
    bcc: [],
    replyTo: [],
}
const all = [email.from, ...email.to, ...email.cc, ...email.bcc, ...email.replyTo]
// console.log('all', JSON.stringify(all, null, 2))
for (const address of all) {
    addressesToUpsert.set(address.address, address);
}
for (const address of addressesToUpsert.values()) {
    console.log('address', address)
}

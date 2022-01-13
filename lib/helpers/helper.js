const fs = require('fs');
const {existsSync, writeFileSync, readFileSync} = require('fs');


function getString(start, end, all) {
	const regex = new RegExp(`${start}(.*?)${end}`);
	const str = all
	const result = regex.exec(str);
	return result;
}

const createEncPassword = pwd => {
	return `#PWD_INSTAGRAM_BROWSER:0:${Date.now()}:${pwd}`
}


async function saveState(ig) {
    return writeFileSync('./tmp/state.json', await ig.exportState(), { encoding: 'utf8' });
}

async function readState(ig) {
    if (!await existsSync('./tmp/state.json'))
        return;
    await ig.importState(await readFileSync('./tmp/state.json', {encoding: 'utf8'}));
}

async function loginToInstagram(ig, username, password) {
    if (!await fs.existsSync('./tmp/state.json')) {
        ig.request.end$.subscribe(() => saveState(ig));
    }
    await ig.simulate.preLoginFlow();
    await ig.account.login(username, password);
    
}


function logEvent(name) {
    return (data) => {data, name};
}

function isValidUrl(string) {
    try {
      new URL(string);
    } catch (_) {
      return false;  
    }
  
    return true;
  }



module.exports = {
	getString,
	createEncPassword,
    readState,
    loginToInstagram,
    logEvent,
    saveState,
    isValidUrl
}
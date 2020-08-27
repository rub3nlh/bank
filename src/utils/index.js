function getKeyRandom(sessionId) {
    function randomString(string_length) {
        const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZ";
        let randomstring = '';
        for (let i=0; i<string_length; i++) {
            const rnum = Math.floor(Math.random() * chars.length);
            randomstring += chars.substring(rnum,rnum+1);
        }
        return randomstring;
    }

    const cryptoValue = randomString(10);
    const keyRandom = sessionId.substring(0,7) + cryptoValue + Date.now();
    return keyRandom;
}

function parseCookies(arrayCookies) {
    const cookies = {};
    arrayCookies.forEach(cookie => {
        const matchedCookie = cookie.match(/([^=]+)=([^;]+);/);
        const name = matchedCookie[1];
        const value = matchedCookie[2];
        cookies[name] = value;
    });
    return cookies;
}

function getXMLField(xml, fieldName) {
    const reField = new RegExp(`<${fieldName}>([^<]+)<\/${fieldName}>`);
    const fieldMatch = xml.match(reField);
    return fieldMatch[1];
}

function formatAmount(amount) {
    return amount.toString().replace(/\./g, ',');
}

function cleanIban(iban) {
    return iban.replace(/\s/g, '');
}

export {getKeyRandom, parseCookies, getXMLField, formatAmount, cleanIban};

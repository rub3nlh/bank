import qs from 'querystring';
import Aes from 'utils/AES';
import Client from 'utils/client';
import {Country} from 'utils/constants';
import {
    getKeyRandom,
    parseCookies,
    getXMLField,
    formatAmount,
    cleanIban,
    parseAmount,
} from 'utils';
import {LoginError, ValidationError} from 'exceptions';

const client = Client.create({
    baseURL: 'https://www.bancsabadell.com',
    //tracePath: '/tmp/traces'  // Useful in develop
});

async function getBankName(iban) {
    const bankCode = iban.substring(4, 8);
    const response = await client.get('/neti/banks.xml');

    const regex = new RegExp(`c="${bankCode}"><!\\[CDATA\\[([^\\]]+)]]`);
    const bankMatch = response.data.match(regex);
    const bankName = bankMatch[1].trim();
    console.log('BankName found', bankName);

    return bankName;
}

function getSender(xml) {
    return {
        town: getXMLField(xml, 'town'),
        nif: getXMLField(xml, 'nif'),
        name: getXMLField(xml, 'name'),
        country: getXMLField(xml, 'country'),
        personNumber: getXMLField(xml, 'personNumber'),
        address: getXMLField(xml, 'address'),
    };
}

async function login(nif, password) {
    let response;
    response = await client.get(
        '/cs/Satellite/SabAtl/Empresas/1191332202619/es/',
    );
    const cookies = parseCookies(response.headers['set-cookie']);
    const sid = cookies['JSESSIONID'];

    const ip = '37.223.126.187';
    const timestamp = Date.now();
    const wtf = `${ip}.${timestamp}`;
    const params = {
        key: getKeyRandom(sid),
        language: 'CAS',
    };
    const data = {
        language: 'CAS',
        'evision.userLang': '',
        'evision.RSADeviceFso': '',
        'evision.RSADevicePrint':
            'version%3D3%2E5%2E1%5F4%26pm%5Ffpua%3Dmozilla%2F5%2E0%20%28x11%3B%20linux%20x86%5F64%3B%20rv%3A68%2E0%29%20gecko%2F20100101%20firefox%2F68%2E0%7C5%2E0%20%28X11%29%7CLinux%20x86%5F64%26pm%5Ffpsc%3D24%7C1920%7C1080%7C1080%26pm%5Ffpsw%3D%26pm%5Ffptz%3D1%26pm%5Ffpln%3Dlang%3Des%2DES%7Csyslang%3D%7Cuserlang%3D%26pm%5Ffpjv%3D0%26pm%5Ffpco%3D1%26pm%5Ffpasw%3D%26pm%5Ffpan%3DNetscape%26pm%5Ffpacn%3DMozilla%26pm%5Ffpol%3Dtrue%26pm%5Ffposp%3D%26pm%5Ffpup%3D%26pm%5Ffpsaw%3D1920%26pm%5Ffpspd%3D24%26pm%5Ffpsbd%3D%26pm%5Ffpsdx%3D%26pm%5Ffpsdy%3D%26pm%5Ffpslx%3D%26pm%5Ffpsly%3D%26pm%5Ffpsfse%3D%26pm%5Ffpsui%3D%26pm%5Fos%3DLinux%26pm%5Fbrmjv%3D68%26pm%5Fbr%3DFirefox%26pm%5Finpt%3D%26pm%5Fexpt%3D',
        'evision.csid': sid,
        'evision.deviceTokenCookie': wtf,
        userNIF: nif,
        pinNIF: password,
        pinCIF: '',
        userDNI: nif,
        pin: password,
        userCard: '',
        injvalrnd: 'false',
        injextrnd: '',
        inputAtributes0: 'false',
        inputAtributes1: 'es-ES',
        inputAtributes2: '24',
        inputAtributes3: '',
        inputAtributes4: '4',
        inputAtributes5: '1920,1080',
        inputAtributes6: '-120',
        inputAtributes7: 'Europe/Madrid',
        inputAtributes8: 'Linux x86_64',
        inputAtributes9:
            'Intel Open Source Technology Center~Mesa DRI Intel(R) Sandybridge Mobile ',
        inputAtributes10: 'false',
        inputAtributes11: '0,false,false',
    };
    const urlEncodedData = qs.stringify(data);
    response = await client.post(
        '/txempbs/LoginDNISCA.doLogin.bs',
        urlEncodedData,
        {
            params,
            headers: {
                Accept: 'application/json, text/javascript, */*; q=0.01',
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
            },
        },
    );
    const {result} = response.data[0];
    if (result !== 'OK') {
        throw new LoginError(result);
    }

    params.key = getKeyRandom(sid);
    response = await client.post(
        '/txempbs/LoginDNISCA.setLogged.bs',
        urlEncodedData,
        {
            params,
            headers: {
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        },
    );

    response = await client.get('/txempbs/LoginFW.getInfo.bs', {
        headers: {
            'User-Agent': 'XMLHTTP/1.0',
            Accept: '*/*',
        },
    });
    console.log('Login done');
    return {sid};
}

async function createNationalTransfer(
    {sourceAccount, destinationAccount, amount, nif, beneficiary, concept},
    sid,
) {
    function getFormFields(html) {
        const randNumberMatch = html.match(/randNumber=([-\d]+)/);
        const randNumber = randNumberMatch[1];
        console.log(`Randnumber found: ${randNumber}`);

        // Sorry it's a very cryptic code but... ¯\_(ツ)_/¯
        const ibanJsCodeMatch = html.match(
            /if \(ibanLabelClean.length < 1\) {([^}]+)}/,
        );
        const reFields = /\("#(_[A-Z0-9]+)"\)/g;
        let ibanFieldMatch,
            ibanFieldArray = [];
        while ((ibanFieldMatch = reFields.exec(ibanJsCodeMatch[1]))) {
            ibanFieldArray.push(ibanFieldMatch[1]);
        }
        const [
            ibanField_4_8,
            ibanField_8_12,
            ibanField_12_14,
            ibanField_14,
        ] = ibanFieldArray;
        console.log(`IbanFields found: ${ibanFieldArray}`);

        const amountJsCodeMatch = html.match(
            /function checkInputAmount\(\) {([^}]+)}/,
        );
        const amountFieldMatch = reFields.exec(amountJsCodeMatch[1]);
        const amountField = amountFieldMatch[1];
        console.log(`amountField found: ${amountField}`);

        const conceptFieldMatch = html.match(
            /function setNominaPurpose\((_[A-Z0-9]+)\)/,
        );
        const conceptField = conceptFieldMatch[1];
        console.log(`conceptField found: ${conceptField}`);

        const detailFieldMatch = html.match(
            /if\(g=="DETALLE"\)document.getElementsByName\("(_[A-Z0-9]+)"\)/,
        );
        const detailField = detailFieldMatch[1];
        console.log(`detailField found: ${detailField}`);

        return {
            randNumber,
            ibanField_4_8,
            ibanField_8_12,
            ibanField_12_14,
            ibanField_14,
            amountField,
            conceptField,
            detailField,
        };
    }

    function validateTransfer(html) {
        function extractField(html, fieldName) {
            try {
                const regex = new RegExp(
                    `${fieldName}:?<\/td>\\s*<td [^\>]+>([^<]+)<`,
                );
                const fieldMatch = html.match(regex);
                return fieldMatch[1].trim();
            } catch (e) {
                throw new ValidationError(
                    `Error in transfer validation. Field <${fieldName}> couldn't be found in transfer html`,
                );
            }
        }

        function validateField(found, expected, fieldName) {
            if (found !== expected) {
                throw new ValidationError(
                    `Error in transfer validation. [${fieldName}] expected <${expected}> found <${found}>`,
                );
            }
        }

        // Throw error if transfer values not found in html
        const sourceAccountFound = extractField(html, 'Cuenta origen').split(
            '/',
        )[0];
        const destinationAccountFound = extractField(html, 'Cuenta destino');
        const amountFound = extractField(html, 'Importe');

        validateField(
            cleanIban(sourceAccountFound),
            sourceAccount,
            'sourceAccount',
        );
        validateField(
            cleanIban(destinationAccountFound),
            destinationAccount,
            'destinationAccount',
        );
        validateField(parseAmount(amountFound), amount, 'amount');
    }

    let response, data, urlEncodedData;
    response = await client.get('/txempbs/TRExternalTransfer.init.bs', {
        headers: {
            Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
    });
    const {
        randNumber,
        ibanField_4_8,
        ibanField_8_12,
        ibanField_12_14,
        ibanField_14,
        amountField,
        conceptField,
        detailField,
    } = getFormFields(response.data);

    data = {
        'account.bank': sourceAccount.substring(4, 8),
        'account.branch': sourceAccount.substring(8, 12),
        'account.checkDigit': sourceAccount.substring(12, 14),
        'account.accountNumber': '00' + sourceAccount.substring(14),
        originalOperation: 'TRAF',
    };
    urlEncodedData = qs.stringify(data);
    response = await client.post(
        '/txempbs/CUGetSender.init.bs',
        urlEncodedData,
        {
            headers: {
                Accept: '*/*',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        },
    );
    const sender = getSender(response.data);
    console.log('Sender found', sender);

    response = await client.get('/txempbs/TRExternalTransfer.AJAXCall.bs', {
        params: {
            'account.bank': destinationAccount.substring(4, 8),
            'account.branch': destinationAccount.substring(8, 12),
            'account.checkDigit': destinationAccount.substring(12, 14),
            'account.accountNumber': destinationAccount.substring(14),
            randNumber,
        },
        headers: {
            Accept: '*/*',
        },
    });

    const bankName = await getBankName(destinationAccount);
    data = {
        reutilizaTrans: '',
        chargeComission: 'SHA',
        periodicity: '1',
        'unitPeriodicity.handle': 'X',
        accountInputType: '3',
        'evision.userLang': '',
        'evision.RSADevicePrint':
            'version%3D3%2E5%2E1%5F4%26pm%5Ffpua%3Dmozilla%2F5%2E0%20%28x11%3B%20linux%20x86%5F64%3B%20rv%3A68%2E0%29%20gecko%2F20100101%20firefox%2F68%2E0%7C5%2E0%20%28X11%29%7CLinux%20x86%5F64%26pm%5Ffpsc%3D24%7C1920%7C1080%7C1080%26pm%5Ffpsw%3D%26pm%5Ffptz%3D1%26pm%5Ffpln%3Dlang%3Des%2DES%7Csyslang%3D%7Cuserlang%3D%26pm%5Ffpjv%3D0%26pm%5Ffpco%3D1%26pm%5Ffpasw%3D%26pm%5Ffpan%3DNetscape%26pm%5Ffpacn%3DMozilla%26pm%5Ffpol%3Dtrue%26pm%5Ffposp%3D%26pm%5Ffpup%3D%26pm%5Ffpsaw%3D1920%26pm%5Ffpspd%3D24%26pm%5Ffpsbd%3D%26pm%5Ffpsdx%3D%26pm%5Ffpsdy%3D%26pm%5Ffpslx%3D%26pm%5Ffpsly%3D%26pm%5Ffpsfse%3D%26pm%5Ffpsui%3D%26pm%5Fos%3DLinux%26pm%5Fbrmjv%3D68%26pm%5Fbr%3DFirefox%26pm%5Finpt%3D%26pm%5Fexpt%3D',
        'evision.csid': sid,
        'evision.RSADeviceFso': '',
        checkAJ: 'S',
        opn_name_527149810: sender.name,
        opn_nif_527149810: nif,
        opn_address_527149810: sender.address,
        opn_town_527149810: sender.town,
        opn_country_527149810: sender.country,
        residente: '',
        ownerNumPersonAux: sender.personNumber,
        ownerNumPerson: sender.personNumber,
        ownerNif: nif,
        ownerName: sender.name,
        ownerAddress: sender.address,
        ownerTown: sender.town,
        ownerCountry: sender.country,
        'orderAccount.selectable-index': '0',
        'orderAccount.owner': sender.name,
        orderName: '',
        'beneficiaryAccount.owner': beneficiary,
        ibanField1: destinationAccount.substring(0, 4),
        ibanField2: destinationAccount.substring(4, 8),
        ibanField3: destinationAccount.substring(8, 12),
        ibanField4: destinationAccount.substring(12, 16),
        ibanField5: destinationAccount.substring(16, 20),
        ibanField6: destinationAccount.substring(20),
        [ibanField_4_8]: destinationAccount.substring(4, 8),
        [ibanField_8_12]: destinationAccount.substring(8, 12),
        [ibanField_12_14]: destinationAccount.substring(12, 14),
        [ibanField_14]: destinationAccount.substring(14),
        'beneficiaryAccount.iban.countryCode': destinationAccount.substring(
            0,
            2,
        ),
        'beneficiaryAccount.iban.checkDigit': destinationAccount.substring(
            2,
            4,
        ),
        'beneficiaryAccount.iban.accountNumber': destinationAccount.substring(
            4,
        ),
        label_name_bank_requested: 'Banco destino',
        name_bank_requested: bankName,
        beneficiaryAddress: '',
        beneficiaryCity: '',
        [amountField]: formatAmount(amount),
        'amount.currency': 'EUR',
        [conceptField]: concept,
        [detailField]: concept,
        onStaff: 'N',
        isNomina: 'N',
        radioNomina: '0',
        beneficiaryNif: '',
        nominaCombo: '-1',
        monthCombo: 'Enero',
        yearCombo: '2020',
        'initialDate.day': '',
        'initialDate.month': '',
        'initialDate.year': '',
        EMPRESA: '',
        CENTCTA: '',
        TIPOCTA: '',
        NUMECTA: '',
        'orderAccount2.selectable-index': '',
        itemId: '',
    };
    data.accHash = Aes.Ctr.encrypt(
        destinationAccount.substring(4),
        beneficiary,
        256,
    );
    urlEncodedData = qs.stringify(data);
    response = await client.post(
        '/txempbs/TRExternalTransfer.reinit.bs',
        urlEncodedData,
        {
            headers: {
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        },
    );
    validateTransfer(response.data, {
        sourceAccount,
        destinationAccount,
        amount,
    });

    data = {
        reutilizaTrans: '',
        'securityInput.clearText': '',
        'securityInput.signText': '',
        'securityInput.random': '',
        'securityInput.timeStamp': '',
        onStaff: 'N',
        isNomina: 'N',
        'securityInput.password': '0000',
    };
    urlEncodedData = qs.stringify(data);
    response = await client.post(
        '/txempbs/TRExternalTransfer.password.bs',
        urlEncodedData,
        {
            headers: {
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        },
    );

    console.log(`Transfer complete:
Source account: ${sourceAccount}
Destination account: ${destinationAccount}
Amount: ${amount}
Concept: ${concept}
`);
}

async function createInternationalTransfer(
    {
        sourceAccount,
        destinationAccount,
        swift,
        amount,
        nif,
        beneficiary,
        concept,
    },
    sid,
) {
    function getFormFields(html) {
        const randNumberMatch = html.match(/randNumber=' \+ '([-\d]+)/);
        const randNumber = randNumberMatch[1];
        console.log(`Randnumber found: ${randNumber}`);

        return {
            randNumber,
        };
    }

    function validateTransfer(html) {
        function extractField(html, fieldName) {
            try {
                const regex = new RegExp(
                    `${fieldName}:?<\/td>\\s*<td [^\>]+>([^<]+)<`,
                );
                const fieldMatch = html.match(regex);
                return fieldMatch[1].trim();
            } catch (e) {
                throw new ValidationError(
                    `Error in transfer validation. Field <${fieldName}> couldn't be found in transfer html`,
                );
            }
        }

        function validateField(found, expected, fieldName) {
            if (found !== expected) {
                throw new ValidationError(
                    `Error in transfer validation. [${fieldName}] expected <${expected}> found <${found}>`,
                );
            }
        }

        // Throw error if transfer values not found in html
        const sourceAccountFound = extractField(html, 'Cuenta origen').split(
            '/',
        )[0];
        const destinationAccountFound = extractField(html, 'IBAN');
        const amountFound = extractField(html, 'Importe');

        validateField(
            cleanIban(sourceAccountFound),
            sourceAccount,
            'sourceAccount',
        );
        validateField(
            cleanIban(destinationAccountFound),
            destinationAccount,
            'destinationAccount',
        );
        validateField(parseAmount(amountFound), amount, 'amount');
    }

    let response, data, urlEncodedData;
    response = await client.get('/txempbs/TRExTransferNew2.init.bs', {
        headers: {
            Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
    });
    const {randNumber} = getFormFields(response.data);

    response = await client.get('/txempbs/TRExTransferNew2.AJAXCall.bs', {
        params: {
            'account.accountNumber': destinationAccount,
            randNumber,
        },
        headers: {
            Accept: '*/*',
        },
    });

    data = {
        'account.bank': sourceAccount.substring(4, 8),
        'account.branch': sourceAccount.substring(8, 12),
        'account.checkDigit': sourceAccount.substring(12, 14),
        'account.accountNumber': '00' + sourceAccount.substring(14),
        originalOperation: 'TRIX',
    };
    urlEncodedData = qs.stringify(data);
    response = await client.post(
        '/txempbs/CUGetSender.init.bs',
        urlEncodedData,
        {
            headers: {
                Accept: '*/*',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        },
    );
    const sender = getSender(response.data);
    console.log('Sender found', sender);

    data = {
        'own.tradeInsuranceAccount1': '',
        'own.tradeInsuranceAmount1': '',
        'evision.userLang': '',
        'evision.RSADevicePrint':
            'version%3D3%2E5%2E1%5F4%26pm%5Ffpua%3Dmozilla%2F5%2E0%20%28x11%3B%20linux%20x86%5F64%3B%20rv%3A68%2E0%29%20gecko%2F20100101%20firefox%2F68%2E0%7C5%2E0%20%28X11%29%7CLinux%20x86%5F64%26pm%5Ffpsc%3D24%7C1920%7C1080%7C1080%26pm%5Ffpsw%3D%26pm%5Ffptz%3D1%26pm%5Ffpln%3Dlang%3Des%2DES%7Csyslang%3D%7Cuserlang%3D%26pm%5Ffpjv%3D0%26pm%5Ffpco%3D1%26pm%5Ffpasw%3D%26pm%5Ffpan%3DNetscape%26pm%5Ffpacn%3DMozilla%26pm%5Ffpol%3Dtrue%26pm%5Ffposp%3D%26pm%5Ffpup%3D%26pm%5Ffpsaw%3D1920%26pm%5Ffpspd%3D24%26pm%5Ffpsbd%3D%26pm%5Ffpsdx%3D%26pm%5Ffpsdy%3D%26pm%5Ffpslx%3D%26pm%5Ffpsly%3D%26pm%5Ffpsfse%3D%26pm%5Ffpsui%3D%26pm%5Fos%3DLinux%26pm%5Fbrmjv%3D68%26pm%5Fbr%3DFirefox%26pm%5Finpt%3D%26pm%5Fexpt%3D',
        'evision.csid': sid,
        'evision.RSADeviceFso': '',
        'account.bank': '',
        'account.branch': '',
        'account.checkDigit': '',
        'account.accountNumber': '',
        'account.currency': '',
        valueEuros: '1',
        indUrgencia: '',
        'orderAccount.currency': 'EUR',
        'orderAccount.joint': 'I',
        reutilizaTrans: '',
        name: 'userExTransferInfo',
        lanzoOP: '1',
        'orderAccount.selectable-index': '0',
        opn_name_527149810: sender.name,
        opn_nif_527149810: nif,
        opn_address_527149810: sender.address,
        opn_town_527149810: sender.town,
        opn_country_527149810: sender.country,
        residente: 'S',
        ownerNumPersonAux: sender.personNumber,
        ownerNumPerson: sender.personNumber,
        ownerNif: nif,
        ownerName: sender.name,
        ownerAddress: sender.address,
        ownerTown: sender.town,
        ownerCountry: sender.country,
        'beneficiaryAccount.accountNumber': destinationAccount,
        bicCode: swift,
        'destinyCountry.handle': beneficiary.country,
        'destinyCountry.value': Country[beneficiary.country],
        bicAddress: '',
        bicCity: '',
        'beneficiaryAccount.owner': beneficiary.name,
        beneficiaryAddress: beneficiary.address,
        beneficiaryCity: beneficiary.town,
        'beneficiaryCountry.handle': beneficiary.country,
        'amount.value': formatAmount(amount),
        'amount.currency': 'EUR',
        valueDate: '',
        valueDateRange: '-1',
        'cashComission.handle': 'SHA',
        paymentDetail: concept,
        'cessionCode.value': '',
        'cessionCode.handle': '',
        financing: 'N',
        amountFormat: '',
        tradeInsurance: 'N',
        canLoadCoba: 'true',
    };
    data.accHash = Aes.Ctr.encrypt(destinationAccount, beneficiary.name, 256);
    urlEncodedData = qs.stringify(data);
    response = await client.post(
        '/txempbs/TRExTransferNew2.init.bs',
        urlEncodedData,
        {
            headers: {
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        },
    );
    validateTransfer(response.data, {
        sourceAccount,
        destinationAccount,
        amount,
    });

    data = {
        indUrgencia: '',
        reutilizaTrans: '',
        'securityInput.clearText': '',
        'securityInput.signText': '',
        'securityInput.random': '',
        'securityInput.timeStamp': '',
        changeAssurance: 'N',
        'securityInput.password': '0000',
    };
    urlEncodedData = qs.stringify(data);
    response = await client.post(
        '/txempbs/TRExTransferNew2.password.bs',
        urlEncodedData,
        {
            headers: {
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        },
    );

    console.log(`International transfer complete:
Source account: ${sourceAccount}
Destination account: ${destinationAccount}
Swift: ${swift}
Amount: ${amount}
Concept: ${concept}
Country: ${Country[beneficiary.country]}
`);
}

export {login, createNationalTransfer, createInternationalTransfer};

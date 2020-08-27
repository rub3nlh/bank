import axios from 'axios';
import axiosCookieJarSupport from 'axios-cookiejar-support';
import tough from 'tough-cookie';
import fs from 'fs';

axiosCookieJarSupport(axios);

let requestIdx = 0;
let responseIdx = 0;
export default {
    create: (options) => {
        const cookieJar = new tough.CookieJar();
        const client = axios.create({
            jar: cookieJar,
            withCredentials: true,
            headers: {
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:68.0) Gecko/20100101 Firefox/68.0"
            },
            ...options
        });

        client.interceptors.request.use(function (config) {
            const {method, url, baseURL} = config;
            console.log(`Request [${method}] ${baseURL}${url}`);

            if(options.tracePath) {
                requestIdx += 1;
                const filename = `${requestIdx}.request.json`
                fs.writeFile(`${options.tracePath}/${filename}`, JSON.stringify({
                    method,
                    url: baseURL + url,
                    data: config.data,
                    params: config.params,
                    headers: config.headers,
                    cookies: config.jar.store
                }), ()=>{});
            }
            return config;
        });

        if(options.tracePath) {
            client.interceptors.response.use(function (response) {
                responseIdx += 1;
                const filename = `${responseIdx}.response.txt`
                fs.writeFile(`${options.tracePath}/${filename}`, response.data, ()=>{});
                return response;
            });
        }

        return client;
    }
};

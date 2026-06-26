const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'dist')));
const server = app.listen(3456, async () => {
    console.log("Server started on 3456");
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        // Mock pywebview injection
        await page.evaluateOnNewDocument(() => {
            window.pywebview = {
                api: {
                    get_recent_projects: async () => [],
                    get_credentials: async () => ({}),
                    log_message: async (msg) => console.log(msg),
                    select_folder: async () => "C:/TestWorkspace"
                }
            };
            window.dispatchEvent(new Event('pywebviewready'));
        });

        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        
        await page.goto('http://localhost:3456');
        
        // wait for render
        await new Promise(r => setTimeout(r, 2000));
        
        // trigger workspace open to show WorkspaceLayout by clicking the open folder button
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('.welcome-card-title'));
            const btn = buttons.find(b => b.innerText.includes('Open Folder'));
            if(btn) btn.click();
        });
        
        await new Promise(r => setTimeout(r, 2000));
        
        const html = await page.evaluate(() => document.getElementById('root').innerHTML);
        console.log("DOM_DUMP_START");
        console.log(html);
        console.log("DOM_DUMP_END");
        
        const styles = await page.evaluate(() => {
            const el = document.querySelector('.bottom-panel-container') || document.querySelector('.breadcrumbs-bar') || document.querySelector('.titlebar');
            return el ? el.outerHTML : "NOT FOUND";
        });
        console.log("EL:", styles);

        await browser.close();
        server.close();
    } catch(e) {
        console.error(e);
        server.close();
    }
});

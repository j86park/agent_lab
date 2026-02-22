const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(filePath));
        } else {
            results.push(filePath);
        }
    });
    return results;
}

const files = walk('frontend/src').filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const orig = content;

    // 1. catch (err: any) -> catch (err)
    // 2. catch (error: any) -> catch (error)
    content = content.replace(/catch\s*\((err|error)\s*:\s*any\)/g, 'catch ($1)');

    // err.message -> getErrorMessage(err)
    if (content.includes('catch (err)')) {
        content = content.replace(/err\.message/g, 'getErrorMessage(err)');
        if (!content.includes('import { getErrorMessage }') && content.includes('getErrorMessage(err)')) {
            content = 'import { getErrorMessage } from "@/lib/utils";\n' + content;
        }
    }

    // Value: any -> unknown or specific
    content = content.replace(/value:\s*any/g, 'value: string | number | boolean | object | null | undefined');

    // detail?: any -> detail?: unknown
    content = content.replace(/detail\?:\s*any;/g, 'detail?: unknown;');

    if (content !== orig) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated ' + file);
        changedCount++;
    }
});
console.log('Total files changed: ' + changedCount);

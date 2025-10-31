document.addEventListener('DOMContentLoaded', function() {
    const PRICE_STEP = 5;

    const urlParams = new URLSearchParams(window.location.search);
    const seed = urlParams.get('seed') || urlParams.get('s') || '';
    const providedHash = urlParams.get('hash') || urlParams.get('h') || '';
    const cp = urlParams.get('cp');
    const cpi = urlParams.get('cpi');
    const stepParam = urlParams.get('st');
    const betsCsv = urlParams.get('bets');
    const bets64 = urlParams.get('bets64');
    const gameType = urlParams.get('gameType') || 'dynamic';

    document.getElementById('seed').value = seed;
    document.getElementById('hash').value = providedHash;

    function verifySeedHash(seed) {
        const hash = '0x' + CryptoJS.SHA256(seed).toString();
        return hash;
    }

    function getDelta(seed, index) {
        const hashSource = `${seed}-${index}`;
        const hash = CryptoJS.SHA256(hashSource).toString();
        const numericHash = parseInt(hash.slice(0, 8), 16);
        const result = numericHash % 3;

        if (result === 0) return -1;
        if (result === 1) return 0;
        return 1;
    }

    function getDeltaWeighted(seed, index) {
        const hashSource = `${seed}-${index}`;
        const hash = CryptoJS.SHA256(hashSource).toString();
        const numericHash = parseInt(hash.slice(0, 8), 16);
        const percentage = numericHash % 1000;

        if (percentage < 25) return -1;
        if (percentage < 975) return 0;
        return 1;
    }

    function reconstructPrices(seed, maxIndex, currentPrice, currentPriceIndex) {
        const deltas = new Array(maxIndex + 1).fill(0);
        const deltaFunction = gameType === 'stable' ? getDeltaWeighted : getDelta;
        for (let i = 1; i <= maxIndex; i++) deltas[i] = deltaFunction(seed, i);
        const prefix = new Array(maxIndex + 1).fill(0);
        for (let i = 1; i <= maxIndex; i++) prefix[i] = prefix[i - 1] + deltas[i];
        const usedStep = Number(stepParam) || PRICE_STEP;
        const basePrice = currentPrice - usedStep * prefix[currentPriceIndex];
        const prices = new Array(maxIndex + 1).fill(0);
        for (let i = 0; i <= maxIndex; i++) prices[i] = basePrice + usedStep * prefix[i];
        return prices;
    }

    function displayResultsFromApi(api) {
        const tableBody = document.getElementById('results-body');
        tableBody.innerHTML = '';
        const { game, bettings } = api || {};
        if (!game || !bettings) return;

        const maxGrid = Math.max(
            Number(game.currentGridIndex) || 0,
            ...bettings.map(b => Number(b.gridIndex) || 0)
        );
        const maxIndex = Math.max(
            Number(game.currentPriceIndex) || 0,
            maxGrid * 4
        );

        const prices = reconstructPrices(
            game.seed,
            maxIndex,
            Number(game.currentPrice),
            Number(game.currentPriceIndex)
        );

        const grouped = new Map();
        for (const b of bettings) {
            const g = Number(b.gridIndex);
            if (!grouped.has(g)) grouped.set(g, new Set());
            grouped.get(g).add(Number(b.betPrice));
        }

        const sortedGrids = Array.from(new Set([...(grouped.keys()), Number(game.currentGridIndex)])).filter(x => Number.isFinite(x)).sort((a,b)=>a-b);
        for (const g of sortedGrids) {
            const row = document.createElement('tr');

            const columnCell = document.createElement('td');
            columnCell.textContent = String(g);
            row.appendChild(columnCell);

            const tradeCell = document.createElement('td');
            const tradeOptions = document.createElement('div');
            tradeOptions.className = 'trade-options';
            const mpIndices = [4*g - 3, 4*g - 2, 4*g - 1, 4*g].filter(i => i >= 1 && i < prices.length);
            const mpList = mpIndices.map(i => prices[i]);

            const trades = grouped.get(g) ? Array.from(grouped.get(g)).sort((a,b)=>a-b) : [];
            for (const price of trades) {
                const button = document.createElement('button');
                button.className = 'trade-button ' + (mpList.includes(price) ? 'win' : 'lose');
                button.textContent = gameType === 'stable' ? (price / 100000).toFixed(5) : String(price);
                tradeOptions.appendChild(button);
            }
            tradeCell.appendChild(tradeOptions);
            row.appendChild(tradeCell);

            const priceCell = document.createElement('td');
            const priceResults = document.createElement('div');
            priceResults.className = 'price-results';
            for (const mp of mpList) {
                if (Number.isFinite(mp)) {
                    const btn = document.createElement('button');
                    btn.className = 'price-button';
                    btn.textContent = gameType === 'stable' ? (mp / 100000).toFixed(5) : String(mp);
                    priceResults.appendChild(btn);
                }
            }
            priceCell.appendChild(priceResults);
            row.appendChild(priceCell);

            tableBody.appendChild(row);
        }
    }

    function verifyAndDisplaySeed(seedValue, seedHashValue) {
        const calculatedHash = seedValue ? verifySeedHash(seedValue) : '';
        const verificationStatus = document.getElementById('verification-status');
        if (!seedValue || !seedHashValue) { verificationStatus.innerHTML = ''; return; }
        if (calculatedHash.toLowerCase() === seedHashValue.toLowerCase()) {
            verificationStatus.innerHTML = `
                <div class="verification-success">
                    <span class="verification-text">Hash matches!</span>
                    <img src="assets/icons/match.svg" alt="Match" class="verification-icon">
                </div>`;
        } else {
            verificationStatus.innerHTML = `
                <div class="verification-failed">
                    <span class="verification-text">Hash does not match!</span>
                    <img src="assets/icons/unmatch.svg" alt="Unmatch" class="verification-icon">
                </div>`;
        }
    }

    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const inputElement = document.getElementById(targetId);
            
            const textToCopy = inputElement.value;
            
            const copyToClipboard = async () => {
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    return true;
                } catch (err) {
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = textToCopy;
                        textArea.style.position = 'absolute';
                        textArea.style.left = '-999999px';
                        textArea.style.top = '-999999px';
                        textArea.style.opacity = '0';
                        textArea.style.pointerEvents = 'none';
                        textArea.style.userSelect = 'none';
                        document.body.appendChild(textArea);
                        
                        const range = document.createRange();
                        range.selectNodeContents(textArea);
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                        
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        selection.removeAllRanges();
                        return true;
                    } catch (fallbackErr) {
                        return false;
                    }
                }
            };
            
            copyToClipboard().then(success => {
                if (success) {
                    const originalHTML = this.innerHTML;
                    this.innerHTML = '<img src="assets/icons/match.svg" alt="Copied" class="copy-icon">';
                    
                    setTimeout(() => {
                        this.innerHTML = originalHTML;
                    }, 3000);
                }
            });
        });
    });



    function parseBetsFromParams() {
        const parsed = [];
        
        if (betsCsv) {
            betsCsv.split(',').forEach(tok => {
                const [g, p] = tok.split(':');
                if (g && p) parsed.push([Number(g), Number(p)]);
            });
        }
        if (bets64) {
            try {
                const padded = bets64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(bets64.length / 4) * 4, '=');
                
                try {
                    const compressed = new Uint8Array(atob(padded).split('').map(c => c.charCodeAt(0)));
                    const jsonString = pako.ungzip(compressed, { to: 'string' });
                    const arr = JSON.parse(jsonString);
                    
                    for (const [g, p] of arr) {
                        if (g !== undefined && p !== undefined) {
                            parsed.push([Number(g), Number(p)]);
                        }
                    }
                } catch (gzipError) {
                    console.log('Gzip decompression failed, trying regular JSON:', gzipError.message);
                    const json = atob(padded);
                    const arr = JSON.parse(json);
                    
                    for (const [g, p] of arr) {
                        if (g !== undefined && p !== undefined) {
                            parsed.push([Number(g), Number(p)]);
                        }
                    }
                }
            } catch (error) {
                console.error('Error parsing bets64:', error);
            }
        }
        return parsed;
    }

    verifyAndDisplaySeed(seed, providedHash);
    const betsFromParams = parseBetsFromParams();
    
    if (seed && providedHash && cp && cpi && betsFromParams.length) {
        const apiLike = {
            game: {
                seed,
                seedHash: providedHash,
                currentPrice: Number(cp),
                currentPriceIndex: Number(cpi),
                currentGridIndex: Math.max(...betsFromParams.map(([g]) => g))
            },
            bettings: betsFromParams.map(([gridIndex, betPrice]) => ({ gridIndex, betPrice }))
        };
        displayResultsFromApi(apiLike);
    }


});

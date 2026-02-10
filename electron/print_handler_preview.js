// ========== PRINTING ==========

ipcMain.handle('print:bill', async (event, billData) => {
    console.log('📄 Opening bill preview');

    try {
        // Create a visible preview window
        const printWindow = new BrowserWindow({
            width: 400,
            height: 700,
            title: 'Bill Preview - KM Unavagam',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
            autoHideMenuBar: true,
        });

        // Generate HTML
        const billHTML = generateBillHTML(billData);

        // Wrap in preview container with print button
        const previewHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            font-family: Arial, sans-serif;
                        }
                        .preview-container {
                            padding: 20px;
                            background: #f0f0f0;
                        }
                        .bill-preview {
                            background: white;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            margin-bottom: 20px;
                        }
                        .print-button {
                            width: 100%;
                            padding: 15px;
                            background: #10b981;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            font-size: 16px;
                            font-weight: bold;
                            cursor: pointer;
                        }
                        .print-button:hover {
                            background: #059669;
                        }
                        @media print {
                            .preview-container {
                                padding: 0;
                                background: white;
                            }
                            .print-button {
                                display: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="preview-container">
                        <div class="bill-preview">
                            ${billHTML.replace('<!DOCTYPE html><html><head>', '').replace('</head><body>', '').replace('</body></html>', '')}
                        </div>
                        <button class="print-button" onclick="window.print()">🖨️ Print Bill</button>
                    </div>
                </body>
                </html>
            `;

        // Load preview
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(previewHTML)}`);

        console.log('✅ Preview window opened');
        return { success: true, preview: true };

    } catch (error) {
        console.error('Preview error:', error);
        throw error;
    }
});

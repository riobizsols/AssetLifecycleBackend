const ExcelJS = require('exceljs');

/**
 * Export data to Excel format
 * @param {Object} sheetsData - Object with sheet names as keys and data arrays as values
 * @param {Object} res - Express response object
 */
async function exportToExcel(sheetsData, res) {
    try {
        const workbook = new ExcelJS.Workbook();
        
        // Set workbook properties
        workbook.creator = 'Asset Lifecycle Management System';
        workbook.lastModifiedBy = 'System';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Create sheets
        for (const [sheetName, data] of Object.entries(sheetsData)) {
            const worksheet = workbook.addWorksheet(sheetName);
            
            if (data.length === 0) {
                continue;
            }

            // Get headers from first row
            const headers = Object.keys(data[0]);
            
            // Add headers
            worksheet.addRow(headers);
            
            // Style headers
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            // Add data rows
            data.forEach(rowData => {
                const row = [];
                headers.forEach(header => {
                    row.push(rowData[header] || '');
                });
                worksheet.addRow(row);
            });

            // Auto-fit columns
            worksheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, cell => {
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                column.width = Math.min(maxLength + 2, 50);
            });

            // Add borders to all cells
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });
        }

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error in exportToExcel:', error);
        throw error;
    }
}

/**
 * Export data to CSV format
 * @param {Array} data - Array of objects to export
 * @param {Object} res - Express response object
 */
async function exportToCSV(data, res) {
    try {
        if (data.length === 0) {
            res.end();
            return;
        }

        // Get headers from first row
        const headers = Object.keys(data[0]);
        
        // Create CSV content
        let csvContent = '';
        
        // Add headers
        csvContent += headers.map(header => `"${header}"`).join(',') + '\n';
        
        // Add data rows
        data.forEach(rowData => {
            const row = headers.map(header => {
                const value = rowData[header] || '';
                // Escape quotes and wrap in quotes
                return `"${value.toString().replace(/"/g, '""')}"`;
            });
            csvContent += row.join(',') + '\n';
        });

        // Write to response
        res.write(csvContent);
        res.end();

    } catch (error) {
        console.error('Error in exportToCSV:', error);
        throw error;
    }
}

module.exports = {
    exportToExcel,
    exportToCSV
};

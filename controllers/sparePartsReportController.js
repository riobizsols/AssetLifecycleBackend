const sparePartsReportModel = require("../models/sparePartsReportModel");
const reportsCache = require("../utils/reportsCache");
const {
  logReportApiCall,
  logReportDataRetrieval,
  logReportDataRetrieved,
  logReportFiltersApplied,
  logNoDataFound,
  logLargeResultSet,
  logReportGenerationError,
  logDatabaseQueryError,
  logDatabaseConnectionFailure,
} = require("../eventLoggers/reportsEventLogger");

const APP_ID = "SPAREPARTSREPORT";
const REPORT_TYPE = "Spare Parts";

const parseArrayParam = (param) => {
  if (param === undefined || param === null || param === "") return null;
  if (Array.isArray(param)) return param;
  return [param];
};

const parseAdvancedConditions = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn("[SparePartsReport] Failed to parse advancedConditions:", error.message);
      return null;
    }
  }
  return value;
};

const buildFilters = (req) => {
  const {
    purchaseDateRange,
    category,
    brand,
    currentStatus,
    status,
    advancedConditions,
    limit = 1000,
    offset = 0,
  } = req.query;

  const filters = {
    purchaseDateRange: parseArrayParam(purchaseDateRange),
    category: parseArrayParam(category),
    brand: parseArrayParam(brand),
    currentStatus: parseArrayParam(currentStatus || status),
    advancedConditions: parseAdvancedConditions(advancedConditions),
    limit: parseInt(limit, 10) || 1000,
    offset: parseInt(offset, 10) || 0,
    org_id: req.user?.org_id || null,
    hasSuperAccess: Boolean(req.user?.hasSuperAccess),
  };

  if (!filters.hasSuperAccess && req.user?.branch_id) {
    filters.branch_id = req.user.branch_id;
  }

  return filters;
};

const getSparePartsReport = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;

  try {
    const filters = buildFilters(req);

    await logReportApiCall({
      appId: APP_ID,
      operation: "Get Spare Parts Report",
      method: req.method,
      url: req.originalUrl,
      requestData: {
        hasFilters: Object.keys(req.query).length > 2,
        limit: filters.limit,
        offset: filters.offset,
      },
      userId,
    });

    const appliedFilters = Object.keys(filters).filter(
      (key) =>
        filters[key] !== null &&
        key !== "limit" &&
        key !== "offset" &&
        key !== "hasSuperAccess"
    );

    if (appliedFilters.length > 0) {
      await logReportFiltersApplied({
        appId: APP_ID,
        reportType: REPORT_TYPE,
        filters: Object.fromEntries(appliedFilters.map((key) => [key, filters[key]])),
        userId,
      });
    }

    await logReportDataRetrieval({
      appId: APP_ID,
      reportType: REPORT_TYPE,
      filters,
      userId,
    });

    const { data: cachedPayload } = await reportsCache.cachedList(
      req,
      "spare-parts",
      filters,
      async () => {
        const [rows, count] = await Promise.all([
          sparePartsReportModel.getSparePartsReportData(filters),
          sparePartsReportModel.getSparePartsReportCount(filters),
        ]);
        return { rows, count: parseInt(count, 10) || 0 };
      }
    );

    const recordCount = cachedPayload.rows?.length || 0;

    if (recordCount === 0) {
      await logNoDataFound({
        appId: APP_ID,
        reportType: REPORT_TYPE,
        filters,
        userId,
        duration: Date.now() - startTime,
      });
    } else {
      await logReportDataRetrieved({
        appId: APP_ID,
        reportType: REPORT_TYPE,
        recordCount,
        filters,
        duration: Date.now() - startTime,
        userId,
      });
      if (recordCount > 500) {
        await logLargeResultSet({
          appId: APP_ID,
          reportType: REPORT_TYPE,
          recordCount,
          threshold: 500,
          userId,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Spare parts report data retrieved successfully",
      data: cachedPayload.rows,
      pagination: {
        total: cachedPayload.count,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + filters.limit < cachedPayload.count,
      },
    });
  } catch (error) {
    console.error("Error in getSparePartsReport:", error);

    const isDbError =
      error.code &&
      (String(error.code).startsWith("23") ||
        String(error.code).startsWith("42") ||
        error.code === "ECONNREFUSED");

    if (error.code === "ECONNREFUSED") {
      await logDatabaseConnectionFailure({
        appId: APP_ID,
        reportType: REPORT_TYPE,
        error,
        userId,
        duration: Date.now() - startTime,
      });
    } else if (isDbError) {
      await logDatabaseQueryError({
        appId: APP_ID,
        reportType: REPORT_TYPE,
        query: "getSparePartsReportData",
        error,
        userId,
        duration: Date.now() - startTime,
      });
    } else {
      await logReportGenerationError({
        appId: APP_ID,
        reportType: REPORT_TYPE,
        error,
        filters: req.query,
        userId,
        duration: Date.now() - startTime,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error retrieving spare parts report data",
      error: error.message,
    });
  }
};

const getSparePartsReportFilterOptions = async (req, res) => {
  try {
    const { data: options } = await reportsCache.cachedFilterOptions(
      req,
      "spare-parts",
      () =>
        sparePartsReportModel.getSparePartsReportFilterOptions({
          org_id: req.user?.org_id || null,
        })
    );

    return res.status(200).json({
      success: true,
      message: "Filter options retrieved successfully",
      data: options,
    });
  } catch (error) {
    console.error("Error in getSparePartsReportFilterOptions:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving spare parts report filter options",
      error: error.message,
    });
  }
};

module.exports = {
  getSparePartsReport,
  getSparePartsReportFilterOptions,
};

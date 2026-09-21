from pydantic import BaseModel, ConfigDict, Field
from typing import List, Dict, Any, Optional

class SystemStatusModel(BaseModel):
    state: str
    stateLabel: str
    stateColor: str
    since: str
    pipeline: str
    dataLatency: str
    lastSync: str
    pradanSync: str
    al1Sync: str
    modelVersion: str
    dataSource: Optional[str] = "Aditya-L1 SoLEXS + HEL1OS"
    dataMode: Optional[str] = "UNKNOWN"
    simSpeed: Optional[float] = 1.0
    simState: Optional[str] = "RUNNING"

class NowcastModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    class_: str = Field(alias="class")
    peakFlux: float
    onset: str
    peakTime: str
    currentPhase: str
    adaptiveThreshold: float
    rollingMAD: float
    zScore: float
    confidence: float

class SingleHorizonForecastModel(BaseModel):
    horizonMinutes: int
    targetTime: str
    probability: int
    status: str
    statusColor: str
    confidence: float
    predictedSoftFlux: Optional[float] = None
    predictedHardFlux: Optional[float] = None

class ForecastModel(BaseModel):
    probability: int
    updatedAt: str
    windowStart: str
    windowEnd: str
    nextClass: str
    leadTime: int
    tcnConfidence: float
    forecast1Min: Optional[SingleHorizonForecastModel] = None
    forecast2Min: Optional[SingleHorizonForecastModel] = None

class HardnessRatioModel(BaseModel):
    current: float
    baseline: float
    threshold: float
    trend: str
    preFlareSignal: bool
    minutesEarly: int

class AlertModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    ts: str
    type: str
    level: str
    msg: str
    class_: Optional[str] = Field(default=None, alias="Class")
    prob: Optional[int] = None
    hr: Optional[float] = None
    derivative: Optional[str] = None
    latency: Optional[str] = None
    model: Optional[str] = None
    horizon: Optional[str] = None

class UnifiedStatusModel(BaseModel):
    systemStatus: SystemStatusModel
    nowcast: NowcastModel
    forecast: ForecastModel
    hardnessRatio: HardnessRatioModel
    alerts: List[AlertModel]
    flareClass: Optional[str] = None
    forecast1Min: Optional[SingleHorizonForecastModel] = None
    forecast2Min: Optional[SingleHorizonForecastModel] = None

class TimeseriesPoint(BaseModel):
    timestamp: int
    softFlux: float
    hardFlux: float
    hardnessRatio: float

class ModelComparisonItemModel(BaseModel):
    name: str
    type: str
    accuracy: float
    precision: float
    recall: float
    f1Score: float
    rocAuc: float
    mae: float
    rmse: float
    r2Score: float
    active: bool
    confusionMatrix: Dict[str, int]

class DatasetSummaryModel(BaseModel):
    filename: str
    totalRows: int
    columnNames: List[str]
    missingValues: Dict[str, int]
    startTime: str
    endTime: str
    flareEventCount: int
    nonFlareEventCount: int
    samplePreview: List[Dict[str, Any]]

class ShortTermPredictionItem(BaseModel):

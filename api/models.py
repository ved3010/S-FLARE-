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


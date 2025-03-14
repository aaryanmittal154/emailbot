from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.database import Base


class JobCandidateMatch(Base):
    """Model to store matches between job postings and candidates"""

    __tablename__ = "job_candidate_matches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_thread_id = Column(String(255), nullable=False, index=True)
    candidate_thread_id = Column(String(255), nullable=False, index=True)
    similarity_score = Column(Float, nullable=False)
    matched_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    match_type = Column(
        String(20), nullable=False
    )  # 'job_to_candidate' or 'candidate_to_job'
    notes = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="matches")

    def __repr__(self):
        return f"<JobCandidateMatch id={self.id} job={self.job_thread_id} candidate={self.candidate_thread_id} score={self.similarity_score:.2f}>"

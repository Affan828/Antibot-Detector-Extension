/**
 * Scrappey Bot Detector - Score Calculator
 * Calculates and aggregates detection confidence scores
 */

const ScoreCalculator = {
  /**
   * Calculate overall confidence for a detector based on matches
   */
  calculateConfidence(matches, detectorBaseConfidence = 50) {
    if (!matches || matches.length === 0) {
      return 0;
    }
    
    // Get the highest confidence from matches
    let maxConfidence = detectorBaseConfidence;
    
    for (const match of matches) {
      if (match.confidence && match.confidence > maxConfidence) {
        maxConfidence = match.confidence;
      }
    }
    
    // Boost confidence based on number of matches
    const matchBoost = Math.min(matches.length * 2, 15);
    
    return Math.min(maxConfidence + matchBoost, 100);
  },
  
  /**
   * Get confidence level string
   */
  getConfidenceLevel(confidence) {
    if (confidence >= 80) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  },
  
  /**
   * Get badge color based on total detections
   */
  getBadgeColor(detectionCount) {
    if (detectionCount === 0) return '#4CAF50'; // Green - clean
    if (detectionCount <= 2) return '#FFA500';  // Orange - some
    return '#FF4444'; // Red - many
  },
  
  /**
   * Get badge text
   */
  getBadgeText(detectionCount) {
    if (detectionCount === 0) return '';
    if (detectionCount > 99) return '99+';
    return detectionCount.toString();
  },
  
  /**
   * Aggregate multiple detection results
   */
  aggregateResults(detections) {
    const aggregated = {
      total: detections.length,
      byCategory: {
        antibot: 0,
        captcha: 0,
        fingerprint: 0
      },
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      averageConfidence: 0
    };
    
    let totalConfidence = 0;
    
    for (const detection of detections) {
      // Count by category
      const category = (detection.category || '').toLowerCase();
      if (category.includes('anti') || category.includes('bot')) {
        aggregated.byCategory.antibot++;
      } else if (category.includes('captcha')) {
        aggregated.byCategory.captcha++;
      } else if (category.includes('fingerprint')) {
        aggregated.byCategory.fingerprint++;
      }
      
      // Count by confidence level
      const confidence = detection.confidence || 0;
      totalConfidence += confidence;
      
      if (confidence >= 80) {
        aggregated.highConfidence++;
      } else if (confidence >= 50) {
        aggregated.mediumConfidence++;
      } else {
        aggregated.lowConfidence++;
      }
    }
    
    if (detections.length > 0) {
      aggregated.averageConfidence = Math.round(totalConfidence / detections.length);
    }
    
    return aggregated;
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ScoreCalculator = ScoreCalculator;
}


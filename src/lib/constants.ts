export const VERIFY_FIELD_CANDIDATES: Record<string, string[]> = {
  q0: ['q0_score', 'verify_q0', 'score_q0'],
  q1: ['q1_score', 'verify_q1', 'score_q1'],
  q2: ['q2_score', 'verify_q2', 'score_q2'],
  decision: ['verify_decision', 'review_decision', 'decision'],
  notes: ['verify_notes', 'review_notes', 'notes', 'reviewer_note'],
  rule: ['verify_rule', 'review_rule'],
};

export const VERIFY_OPTIONS: Record<string, Record<number, string>> = {
  q0: {
    1: '1 — Triple sai hoặc không liên quan tới ảnh (DROP)',
    2: '2 — Triple yếu / thiếu / chưa đủ tin cậy',
    3: '3 — Triple đúng và hỗ trợ câu hỏi',
    4: '4 — Triple đúng và hỗ trợ suy luận rõ ràng',
  },
  q1: {
    1: '1 — Câu hỏi sai bản chất / hỏi nhầm đối tượng (DROP)',
    2: '2 — Câu hỏi mơ hồ / diễn đạt lỗi (DROP)',
    3: '3 — Câu hỏi đúng nhưng còn chưa gọn',
    4: '4 — Câu hỏi rõ ràng, đúng và tốt',
  },
  q2: {
    1: '1 — Đáp án đúng bị sai',
    2: '2 — Nhiều đáp án đúng hoặc distractor lệch loại',
    3: '3 — Đúng nhưng distractor còn yếu',
    4: '4 — Đúng và distractor tốt',
  },
};

export const VERIFY_TITLES: Record<string, string> = {
  q0: 'Q0: Triple Used Validity',
  q1: 'Q1: Question Validity',
  q2: 'Q2: Choice Quality',
};

export const TRIPLE_REVIEW_OPTIONS: Record<string, string> = {
  valid: 'Valid',
  invalid: 'Invalid',
  needs_edit: 'Needs edit',
  unsure: 'Unsure',
};

export const TRIPLE_REVIEW_CAPTIONS: Record<string, string> = {
  valid: 'Triple đúng và tiếp tục dùng cho VQA này.',
  invalid: 'Triple sai, không nên dùng cho VQA này.',
  needs_edit: 'Triple còn liên quan nhưng cần sửa lại fact.',
  unsure: 'Chưa đủ chắc để kết luận.',
};

export const OPTIONAL_SCHEMA_HELP: Record<string, string> = {
  triples_retrieved:
    "App sẽ hiển thị tab `Triples retrieved` khi bảng `vqa` có cột `triples_retrieved jsonb`.",
  vqa_kg_triple_map:
    "Để lưu trace VQA ↔ triple, nên có bảng `vqa_kg_triple_map`. Nếu bảng này chưa tồn tại, app vẫn chạy nhưng sẽ không lưu mapping chi tiết.",
  kg_triple_edit_log:
    "Để audit việc sửa triple inline, nên có bảng `kg_triple_edit_log`. Nếu chưa có, app vẫn remap nhưng không lưu log.",
  kg_review_columns:
    "Để Verify KG Triples hoạt động đầy đủ, nên có `is_checked` và `is_drop` trên `kg_triple_catalog`.",
};

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

import streamlit as st
from supabase import create_client

st.set_page_config(layout="wide")
st.title("Vietnamese Food VQA - Annotation Tool")

SUPABASE_URL = "https://cvdoasxazyruytejluvv.supabase.co"
SUPABASE_KEY = st.secrets["SUPABASE_KEY"]
PAGE_SIZE = 1000
PROJECT_ROOT = Path(__file__).resolve().parent
QUESTION_TYPES_CSV = PROJECT_ROOT / "data" / "question_types.csv"


@st.cache_resource
def init_connection():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


supabase = init_connection()


def apply_bool_filter(query, column_name: str, filter_value: str):
    if filter_value == "True":
        return query.is_(column_name, True)
    if filter_value == "False":
        return query.is_(column_name, False)
    return query


def norm_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def fetch_all_rows(query_builder, page_size: int = PAGE_SIZE) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        response = query_builder.range(start, start + page_size - 1).execute()
        batch = response.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return rows


def fetch_image_ids_for_filter(start_id: str, end_id: str) -> list[str]:
    query = (
        supabase.table("image")
        .select("image_id")
        .gte("image_id", start_id)
        .lte("image_id", end_id)
        .eq("is_checked", True)
        .eq("is_drop", False)
        .order("image_id")
    )
    rows = fetch_all_rows(query)
    return [row["image_id"] for row in rows if row.get("image_id")]


@st.cache_data
def fetch_question_types() -> list[str]:
    if not QUESTION_TYPES_CSV.exists():
        return []

    values: list[str] = []
    seen: set[str] = set()
    with QUESTION_TYPES_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            value = norm_text(row.get("canonical_qtype") or row.get("question_type"))
            if value and value not in seen:
                values.append(value)
                seen.add(value)
    return values


def load_image_annotation_page() -> None:
    st.sidebar.header("Chọn ảnh")
    start_id = st.sidebar.text_input("Từ ID (VD: image000000):", value="image000000", key="img_start")
    end_id = st.sidebar.text_input("Đến ID (VD: image000100):", value="image001000", key="img_end")

    st.sidebar.markdown("---")
    filter_is_drop = st.sidebar.selectbox(
        "Lọc theo is_drop:",
        ["Tất cả", "True", "False"],
        index=2,
        key="img_filter_drop",
    )

    filter_is_checked = st.sidebar.selectbox(
        "Lọc theo is_checked:",
        ["Tất cả", "True", "False"],
        index=2,
        key="img_filter_checked",
    )

    query = (
        supabase.table("image")
        .select("image_id")
        .gte("image_id", start_id)
        .lte("image_id", end_id)
        .order("image_id")
    )
    query = apply_bool_filter(query, "is_drop", filter_is_drop)
    query = apply_bool_filter(query, "is_checked", filter_is_checked)
    list_response = query.execute()

    if not list_response.data:
        st.warning("Không có ảnh nào khớp với điều kiện lọc hiện tại!")
        return

    all_ids = [row["image_id"] for row in list_response.data]

    if "next_img_id" in st.session_state:
        if st.session_state.next_img_id in all_ids:
            st.session_state.selected_img = st.session_state.next_img_id
        del st.session_state.next_img_id

    selected_id = st.sidebar.selectbox(
        "Chọn ảnh để xem/sửa:",
        all_ids,
        key="selected_img"
    )

    detail_response = (
        supabase.table("image")
        .select("*")
        .eq("image_id", selected_id)
        .limit(1)
        .execute()
    )

    current_row = detail_response.data[0]

    img_id = current_row["image_id"]
    img_url = current_row["image_url"]
    is_checked_status = current_row.get("is_checked")
    is_drop_status = current_row.get("is_drop")

    current_idx = all_ids.index(img_id) + 1
    total_filtered = len(all_ids)

    checked_text = "🟢 Đã duyệt" if is_checked_status else "🔴 Chưa duyệt"
    drop_text = "🗑️ Drop" if is_drop_status else "✅ Giữ lại"
    st.write(
        f"**Đang xử lý ảnh ID:** `{img_id}` | **Vị trí:** {current_idx}/{total_filtered} | {checked_text} | {drop_text}"
    )

    col1, col2 = st.columns([1, 1])

    with col1:
        st.image(img_url, use_container_width=True)

        st.markdown("---")
        old_drop_status = current_row.get("is_drop")
        default_radio_index = 1 if old_drop_status is True else 0

        keep_image = st.radio(
            "Có nên giữ lại ảnh này không? (Chọn Không nếu ảnh mờ, sai chủ đề)",
            ("Có", "Không"),
            index=default_radio_index,
            horizontal=True,
        )

    with col2:
        st.subheader("Danh sách món ăn")
        st.write("Nhập tên món ăn, **mỗi món trên 1 dòng**. Bấm Enter để xuống dòng gõ tiếp.")

        existing_foods = current_row.get("food_items") or []
        foods_str_default = "\n".join(existing_foods)

        edited_foods_str = st.text_area(
            "Danh sách món (Gõ vào đây):",
            value=foods_str_default,
            height=250,
            key=f"text_area_{img_id}",
        )

        st.markdown("---")
        img_desc_input = st.text_area(
            "Mô tả/Ghi chú thêm về ảnh (Tùy chọn):",
            value=current_row.get("image_desc") or "",
            height=100,
        )

    st.markdown("---")
    if st.button("Lưu", type="primary", use_container_width=True, key="save_image_page"):
        raw_foods = edited_foods_str.split("\n")
        final_foods = [f.strip() for f in raw_foods if f.strip() != ""]

        db_food_items = final_foods if len(final_foods) > 0 else None
        db_image_desc = img_desc_input.strip() if img_desc_input.strip() else None
        is_drop_val = True if keep_image == "Không" else False

        supabase.table("image").update(
            {
                "food_items": db_food_items,
                "image_desc": db_image_desc,
                "is_drop": is_drop_val,
                "is_checked": True,
            }
        ).eq("image_id", img_id).execute()

        current_idx = all_ids.index(selected_id)
        if current_idx + 1 < len(all_ids):
            st.session_state.next_img_id = all_ids[current_idx + 1]

        st.rerun()


def fetch_vqa_rows(
    start_id: str,
    end_id: str,
    vqa_is_drop: str,
    vqa_is_checked: str,
    qtype_filter: str,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    eligible_image_ids = fetch_image_ids_for_filter(start_id, end_id)
    if not eligible_image_ids:
        return [], {}

    image_rows = (
        supabase.table("image")
        .select("image_id,image_url,food_items,image_desc,is_checked,is_drop")
        .in_("image_id", eligible_image_ids)
        .execute()
        .data
        or []
    )
    image_map = {row["image_id"]: row for row in image_rows if row.get("image_id")}

    vqa_rows: list[dict[str, Any]] = []
    chunk_size = 200
    for i in range(0, len(eligible_image_ids), chunk_size):
        chunk_ids = eligible_image_ids[i:i + chunk_size]
        query = (
            supabase.table("vqa")
            .select("vqa_id,image_id,qtype,question,is_checked,is_drop")
            .in_("image_id", chunk_ids)
            .order("image_id")
            .order("vqa_id")
        )
        query = apply_bool_filter(query, "is_drop", vqa_is_drop)
        query = apply_bool_filter(query, "is_checked", vqa_is_checked)
        if qtype_filter != "Tất cả":
            query = query.eq("qtype", qtype_filter)
        resp = query.execute()
        vqa_rows.extend(resp.data or [])

    vqa_rows = [row for row in vqa_rows if row.get("image_id") in image_map]
    return vqa_rows, image_map


def load_vqa_detail(vqa_id: int) -> dict[str, Any] | None:
    resp = (
        supabase.table("vqa")
        .select("*")
        .eq("vqa_id", vqa_id)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None


def fetch_triple_catalog_entries(triples_used: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results = []
    for triple in triples_used or []:
        subject = norm_text(triple.get("subject"))
        relation = norm_text(triple.get("relation"))
        target = norm_text(triple.get("target"))
        if not subject or not relation or not target:
            continue
        resp = (
            supabase.table("kg_triple_catalog")
            .select("subject,relation,target,evidence,source_url")
            .eq("subject", subject)
            .eq("relation", relation)
            .eq("target", target)
            .limit(1)
            .execute()
        )
        row = (resp.data or [{}])[0]
        results.append(
            {
                "subject": subject,
                "relation": relation,
                "target": target,
                "evidence": row.get("evidence") if row else None,
                "source_url": row.get("source_url") if row else None,
            }
        )
    return results


def render_evidence_block(triples_used: list[dict[str, Any]]) -> None:
    st.subheader("Evidence từ Knowledge Graph")
    triple_entries = fetch_triple_catalog_entries(triples_used)
    if not triple_entries:
        st.info("Sample này chưa có triple/evidence để hiển thị.")
        return

    for idx, item in enumerate(triple_entries, start=1):
        triple_text = f"{item['subject']} — {item['relation']} — {item['target']}"
        with st.expander(f"Triple {idx}: {triple_text}", expanded=(idx == 1)):
            evidence = norm_text(item.get("evidence"))
            source_url = norm_text(item.get("source_url"))
            if evidence:
                st.write(evidence)
            else:
                st.caption("Không có evidence.")

            if source_url and source_url != "LLM_Knowledge":
                st.markdown(f"[Mở nguồn]({source_url})")
            elif source_url:
                st.caption(source_url)
            else:
                st.caption("Không có source_url.")


def load_vqa_annotation_page() -> None:
    st.sidebar.header("Chọn VQA")
    start_id = st.sidebar.text_input("Từ ID ảnh (VD: image000000):", value="image000000", key="vqa_start")
    end_id = st.sidebar.text_input("Đến ID ảnh (VD: image000100):", value="image000100", key="vqa_end")

    st.sidebar.markdown("---")
    filter_is_drop = st.sidebar.selectbox(
        "Lọc theo vqa.is_drop:",
        ["Tất cả", "True", "False"],
        index=2,
        key="vqa_filter_drop",
    )
    filter_is_checked = st.sidebar.selectbox(
        "Lọc theo vqa.is_checked:",
        ["Tất cả", "True", "False"],
        index=2,
        key="vqa_filter_checked",
    )

    qtypes = fetch_question_types()
    qtype_filter = st.sidebar.selectbox(
        "Lọc theo qtype:",
        ["Tất cả", *qtypes],
        index=0,
        key="vqa_qtype_filter",
    )

    vqa_rows, image_map = fetch_vqa_rows(start_id, end_id, filter_is_drop, filter_is_checked, qtype_filter)
    if not vqa_rows:
        st.warning("Không có VQA nào khớp với điều kiện lọc hiện tại!")
        return

    vqa_ids = [row["vqa_id"] for row in vqa_rows]
    vqa_meta = {row["vqa_id"]: row for row in vqa_rows}

    if "next_vqa_id" in st.session_state:
        if st.session_state.next_vqa_id in vqa_ids:
            st.session_state.selected_vqa_id = st.session_state.next_vqa_id
        del st.session_state.next_vqa_id

    def format_vqa_option(vqa_id: int) -> str:
        row = vqa_meta[vqa_id]
        question = norm_text(row.get("question"))
        preview = (question[:55] + "...") if len(question) > 58 else question
        return f"{row['image_id']} | {row.get('qtype') or '-'} | #{vqa_id} | {preview}"

    selected_vqa_id = st.sidebar.selectbox(
        "Chọn VQA để xem/sửa:",
        vqa_ids,
        format_func=format_vqa_option,
        key="selected_vqa_id",
    )

    vqa_row = load_vqa_detail(selected_vqa_id)
    if not vqa_row:
        st.error("Không tải được chi tiết VQA.")
        return

    image_row = image_map.get(vqa_row["image_id"])
    if not image_row:
        st.error("Không tìm thấy ảnh nguồn tương ứng.")
        return

    current_idx = vqa_ids.index(selected_vqa_id) + 1
    total_filtered = len(vqa_ids)
    checked_text = "🟢 Đã duyệt" if vqa_row.get("is_checked") else "🔴 Chưa duyệt"
    drop_text = "🗑️ Drop" if vqa_row.get("is_drop") else "✅ Giữ lại"
    st.write(
        f"**Đang xử lý VQA ID:** `{selected_vqa_id}` | **Ảnh:** `{vqa_row['image_id']}` | **Vị trí:** {current_idx}/{total_filtered} | {checked_text} | {drop_text}"
    )

    col1, col2 = st.columns([1, 1])

    with col1:
        st.image(image_row["image_url"], use_container_width=True)
        st.markdown("---")
        st.subheader("Thông tin ảnh")
        st.write(f"**image_id:** `{image_row['image_id']}`")
        foods = image_row.get("food_items") or []
        st.write("**food_items:**", ", ".join(foods) if foods else "(trống)")
        st.write("**image_desc:**")
        st.write(image_row.get("image_desc") or "(trống)")
        st.markdown("---")
        render_evidence_block(vqa_row.get("triples_used") or [])

    with col2:
        old_drop_status = bool(vqa_row.get("is_drop"))
        keep_vqa = st.radio(
            "Có nên giữ lại VQA này không?",
            ("Có", "Không"),
            index=1 if old_drop_status else 0,
            horizontal=True,
            key=f"keep_vqa_{selected_vqa_id}",
        )

        valid_qtypes = fetch_question_types()
        current_qtype = norm_text(vqa_row.get("qtype"))
        if not valid_qtypes:
            st.error("Không đọc được danh sách question type hợp lệ từ data/question_types.csv")
            st.stop()
        if current_qtype not in valid_qtypes and current_qtype:
            st.warning(f"qtype hiện tại không nằm trong question_types.csv: {current_qtype}")
        qtype_index = valid_qtypes.index(current_qtype) if current_qtype in valid_qtypes else 0
        qtype_input = st.selectbox(
            "Question type",
            valid_qtypes,
            index=qtype_index,
            key=f"qtype_{selected_vqa_id}",
        )
        question_input = st.text_area("Question", value=vqa_row.get("question") or "", height=120, key=f"question_{selected_vqa_id}")
        choice_a = st.text_input("Choice A", value=vqa_row.get("choice_a") or "", key=f"choice_a_{selected_vqa_id}")
        choice_b = st.text_input("Choice B", value=vqa_row.get("choice_b") or "", key=f"choice_b_{selected_vqa_id}")
        choice_c = st.text_input("Choice C", value=vqa_row.get("choice_c") or "", key=f"choice_c_{selected_vqa_id}")
        choice_d = st.text_input("Choice D", value=vqa_row.get("choice_d") or "", key=f"choice_d_{selected_vqa_id}")

        answer_letters = ["A", "B", "C", "D"]
        answer_default = vqa_row.get("answer") if vqa_row.get("answer") in answer_letters else "A"
        answer_input = st.selectbox(
            "Đáp án đúng",
            answer_letters,
            index=answer_letters.index(answer_default),
            key=f"answer_{selected_vqa_id}",
        )
        rationale_input = st.text_area(
            "Rationale",
            value=vqa_row.get("rationale") or "",
            height=180,
            key=f"rationale_{selected_vqa_id}",
        )

    st.markdown("---")
    if st.button("Lưu VQA", type="primary", use_container_width=True, key="save_vqa_page"):
        payload = {
            "qtype": qtype_input.strip(),
            "question": question_input.strip(),
            "choice_a": choice_a.strip(),
            "choice_b": choice_b.strip(),
            "choice_c": choice_c.strip(),
            "choice_d": choice_d.strip(),
            "answer": answer_input,
            "rationale": rationale_input.strip() or None,
            "is_drop": True if keep_vqa == "Không" else False,
            "is_checked": True,
        }

        required_errors = []
        for key, label in [
            ("qtype", "Question type"),
            ("question", "Question"),
            ("choice_a", "Choice A"),
            ("choice_b", "Choice B"),
            ("choice_c", "Choice C"),
            ("choice_d", "Choice D"),
        ]:
            if not payload[key]:
                required_errors.append(label)

        if required_errors:
            st.error("Các trường bắt buộc còn trống: " + ", ".join(required_errors))
            st.stop()

        try:
            supabase.table("vqa").update(payload).eq("vqa_id", selected_vqa_id).execute()
        except Exception as exc:  # noqa: BLE001
            st.error(f"Không lưu được VQA: {exc}")
            st.stop()

        current_idx_zero = vqa_ids.index(selected_vqa_id)
        if current_idx_zero + 1 < len(vqa_ids):
            st.session_state.next_vqa_id = vqa_ids[current_idx_zero + 1]
        st.rerun()


page = st.sidebar.radio(
    "Chế độ",
    ["Annotate Food Items", "Annotate VQA"],
    index=1,
)

st.sidebar.markdown("---")

if page == "Annotate Food Items":
    load_image_annotation_page()
else:
    load_vqa_annotation_page()

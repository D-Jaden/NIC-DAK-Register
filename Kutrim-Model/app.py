import gradio as gr
import ctranslate2
import sentencepiece as spm
import os
from huggingface_hub import snapshot_download

MODEL_REPO = "krutrim-ai-labs/Krutrim-Translate"
MODEL_DIR  = "/app/model"

print("Downloading model...")
snapshot_download(
    repo_id=MODEL_REPO,
    local_dir=MODEL_DIR,
    token=os.environ.get("HF_TOKEN"),
)

CT_MODEL_PATH = os.path.join(MODEL_DIR, "ct_model_english_indic")
SRC_SPM_PATH  = os.path.join(MODEL_DIR, "ct_model_english_indic", "vocab", "model.SRC")
TGT_SPM_PATH  = os.path.join(MODEL_DIR, "ct_model_english_indic", "vocab", "model.TGT")

device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
print(f"Loading model on {device}...")
translator = ctranslate2.Translator(CT_MODEL_PATH, device=device)

src_sp = spm.SentencePieceProcessor()
src_sp.Load(SRC_SPM_PATH)

tgt_sp = spm.SentencePieceProcessor()
tgt_sp.Load(TGT_SPM_PATH)

def translate(text: str) -> str:
    if not text.strip():
        return "Please enter some text."

    tokens = src_sp.EncodeAsPieces(text.strip())
    tokens = ["hin_Deva"] + tokens

    results = translator.translate_batch(
        [tokens],
        beam_size=4,
        max_decoding_length=128,
        no_repeat_ngram_size=4,
        repetition_penalty=2.0
    )
    translation = tgt_sp.DecodePieces(results[0].hypotheses[0])
    print(f"Input: {text} | Output: {translation}")
    return translation

demo = gr.Interface(
    fn=translate,
    inputs=gr.Textbox(label="English Text", lines=3),
    outputs=gr.Textbox(label="Hindi Translation", lines=3),
    title="English → Hindi Translator",
    flagging_mode="never"
)

demo.launch()

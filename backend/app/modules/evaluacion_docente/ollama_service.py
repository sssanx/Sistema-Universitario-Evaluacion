
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

"""
Envía instrucciones a Ollama utilizando Qwen 2.5 1.5B
y devuelve el análisis generado.
"""

def analizar_con_ollama(texto):
    """
    Envía instrucciones a Ollama utilizando Qwen 2.5 0.5B
    y devuelve el análisis generado.
    """

    datos = {
"model": "qwen2.5:1.5b",      
  "prompt": texto,
        "stream": False,
        "options": {
    "num_predict": 260,
    "temperature": 0.1,
    "num_ctx": 2048,
},
    }

    solicitud = Request(
        "http://127.0.0.1:11434/api/generate",
        data=json.dumps(datos, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json"
        },
        method="POST",
    )

    try:
        with urlopen(solicitud, timeout=120) as respuesta:
            resultado = json.load(respuesta)

        return resultado["response"].strip()

    except (HTTPError, URLError, TimeoutError) as error:
        raise RuntimeError(
            "No se pudo conectar con Ollama. "
            "Comprueba que Ollama esté funcionando."
        ) from error

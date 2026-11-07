#!/usr/bin/env python3
"""Limpa a pasta de anúncios salvos pelo "Salvar anúncio" (anuncio-<id>.json). Roda no notebook, sem internet.

  python3 limpar-anuncios.py PASTA                       # SÓ MOSTRA o que acha de errado (não mexe em nada)
  python3 limpar-anuncios.py PASTA --aplicar             # move os ruins para PASTA/descartados/ (NUNCA apaga)
  python3 limpar-anuncios.py PASTA --txt anuncios-reais.txt   # grava as descrições boas num .txt para o contar.py

O que conta como ruim (vai para descartados/ com --aplicar):
  JSON quebrado · não é do formato do "Salvar anúncio" · sem descrição · descrição curta demais (< 25 letras)
  · repetido (mesmo id, ou mesma descrição com outro id: repostagem; fica o salvo primeiro).
O que só avisa (não move): telefone/e-mail ainda aparecendo no texto, arquivos muito pesados (a foto vai dentro do JSON).
Com --txt, uma varredura final tira número longo, e-mail e @usuário do texto gravado. Os JSON originais não são alterados.
"""
import argparse, json, re, shutil, sys, unicodedata
from pathlib import Path

MIN_LETRAS = 25
PESADO_MB = 3
FORMATO = "bingo-classificados-1"
RX_FONE = re.compile(r"(\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}|(\d[\s.*-]*){9,}")
RX_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+|@\w{3,}")


def normalizar(texto):
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def ler(caminho):
    try:
        ad = json.loads(caminho.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return None, f"JSON quebrado ({type(e).__name__})"
    if not isinstance(ad, dict) or ad.get("formato") != FORMATO:
        return None, "não é do formato do Salvar anúncio"
    return ad, None


def varrer(texto):
    return re.sub(r"[ \t]+", " ", RX_EMAIL.sub("", RX_FONE.sub("", texto))).strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pasta")
    ap.add_argument("--aplicar", action="store_true", help="move os ruins para PASTA/descartados/")
    ap.add_argument("--txt", metavar="ARQUIVO", help="grava as descrições boas (separadas por ----) para o contar.py")
    a = ap.parse_args()

    pasta = Path(a.pasta)
    if not pasta.is_dir():
        sys.exit(f"pasta não encontrada: {pasta}")
    arquivos = sorted(pasta.glob("anuncio-*.json"))
    if not arquivos:
        sys.exit(f"nenhum anuncio-*.json em {pasta}")

    lidos = []   # (caminho, ad, salvo_em)
    ruins = {}   # caminho -> motivo
    for c in arquivos:
        ad, erro = ler(c)
        if erro:
            ruins[c] = erro
            continue
        desc = (ad.get("d") or "").strip()
        letras = len(re.findall(r"[^\W\d_]", desc))
        if not desc:
            ruins[c] = "sem descrição"
        elif letras < MIN_LETRAS:
            ruins[c] = f"descrição curta demais ({letras} letras)"
        else:
            lidos.append((c, ad, str(ad.get("salvo_em") or "")))

    # repetidos: o salvo primeiro fica
    vistos_id, vistos_texto = {}, {}
    boas = []
    for c, ad, quando in sorted(lidos, key=lambda x: (x[2], x[0].name)):
        chave_id = str(ad.get("id") or "")
        chave_txt = normalizar(ad["d"])
        if chave_id and chave_id in vistos_id:
            ruins[c] = f"repetido (mesmo id de {vistos_id[chave_id].name})"
        elif chave_txt in vistos_texto:
            ruins[c] = f"repetido (mesma descrição de {vistos_texto[chave_txt].name})"
        else:
            if chave_id:
                vistos_id[chave_id] = c
            vistos_texto[chave_txt] = c
            boas.append((c, ad))

    avisos = []
    for c, ad in boas:
        if RX_FONE.search(ad["d"]) or RX_EMAIL.search(ad["d"]):
            avisos.append((c, "telefone/e-mail ainda aparece na descrição"))
        mb = c.stat().st_size / 1048576
        if mb > PESADO_MB:
            avisos.append((c, f"arquivo pesado ({mb:.1f} MB, a foto vai dentro)"))

    print(f"{len(arquivos)} arquivos em {pasta}: {len(boas)} bons, {len(ruins)} ruins, {len(avisos)} aviso(s)\n")
    if ruins:
        print("== ruins" + (" (movidos para descartados/)" if a.aplicar else " (vão para descartados/ com --aplicar)"))
        for c, m in sorted(ruins.items(), key=lambda x: x[0].name):
            print(f"  {c.name}: {m}")
    if avisos:
        print("\n== avisos (não mexo; confira a mão)")
        for c, m in avisos:
            print(f"  {c.name}: {m}")

    cidades = {}
    for _, ad in boas:
        cidades[ad.get("city") or "(sem cidade)"] = cidades.get(ad.get("city") or "(sem cidade)", 0) + 1
    if cidades:
        print("\n== bons por cidade")
        for k, v in sorted(cidades.items(), key=lambda x: -x[1])[:15]:
            print(f"  {v:4d}  {k}")

    if a.aplicar and ruins:
        dest = pasta / "descartados"
        dest.mkdir(exist_ok=True)
        for c in ruins:
            alvo = dest / c.name
            n = 1
            while alvo.exists():
                alvo = dest / f"{c.stem}-{n}{c.suffix}"
                n += 1
            shutil.move(str(c), str(alvo))
        print(f"\nmovi {len(ruins)} arquivo(s) para {dest} (nada foi apagado)")
    elif ruins:
        print("\nnada foi movido. Para mover os ruins:  python3 limpar-anuncios.py " + a.pasta + " --aplicar")

    if a.txt:
        blocos = [varrer(ad["d"]) for _, ad in boas]
        Path(a.txt).write_text("\n----\n".join(blocos) + "\n", encoding="utf-8")
        print(f"\n{len(blocos)} descrições gravadas em {a.txt}  ->  python3 contar.py {a.txt}")


if __name__ == "__main__":
    main()

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Lote, Movimentacao, Produto, Usuario
from app.schemas import PerdaCreate, PerdaOut, PerdaVencidosOut
from app.security import usuario_atual

router = APIRouter(
    prefix="/perdas",
    tags=["Perdas"],
    dependencies=[Depends(usuario_atual)],
)

CENTAVOS = Decimal("0.01")


def baixar_perda(
    db: Session, lote: Lote, quantidade: Decimal, motivo: str, usuario_id: int
) -> Decimal:
    """Tira a quantidade do lote e registra a perda. Retorna o custo perdido."""
    lote.quantidade = Decimal(lote.quantidade) - quantidade
    db.add(
        Movimentacao(
            tipo="perda",
            produto_id=lote.produto_id,
            lote_id=lote.id,
            quantidade=quantidade,
            custo_unitario=lote.custo_unitario,
            motivo=motivo,
            usuario_id=usuario_id,
        )
    )
    return quantidade * Decimal(lote.custo_unitario)


@router.post("", response_model=PerdaOut, status_code=201)
def registrar_perda(
    dados: PerdaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    """Registra perda de um lote (avaria, quebra, furto...). Sem quantidade = lote inteiro."""
    lote = db.get(Lote, dados.lote_id)
    if not lote or not lote.ativo or Decimal(lote.quantidade) <= 0:
        raise HTTPException(404, "Lote não encontrado ou sem estoque")

    quantidade = Decimal(lote.quantidade) if dados.quantidade is None else dados.quantidade
    if quantidade > Decimal(lote.quantidade):
        raise HTTPException(
            409, f"O lote tem apenas {lote.quantidade} na unidade base"
        )

    custo = baixar_perda(db, lote, quantidade, dados.motivo, usuario.id)
    db.commit()
    return PerdaOut(
        lote_id=lote.id,
        produto_id=lote.produto_id,
        quantidade=quantidade,
        custo_total=custo.quantize(CENTAVOS, rounding=ROUND_HALF_UP),
    )


@router.post("/vencidos", response_model=PerdaVencidosOut)
def baixar_vencidos(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    """Dá baixa, como perda, em todos os lotes com validade anterior a hoje."""
    lotes = db.scalars(
        select(Lote).where(
            Lote.ativo == True,
            Lote.quantidade > 0,
            Lote.validade < date.today(),
        )
    ).all()

    quantidade_total = Decimal(0)
    custo_total = Decimal(0)
    for lote in lotes:
        qtd = Decimal(lote.quantidade)
        custo_total += baixar_perda(db, lote, qtd, "vencido", usuario.id)
        quantidade_total += qtd

    db.commit()
    return PerdaVencidosOut(
        lotes_baixados=len(lotes),
        quantidade_total=quantidade_total,
        custo_total=custo_total.quantize(CENTAVOS, rounding=ROUND_HALF_UP),
    )


@router.get("")
def listar_perdas(db: Session = Depends(get_db)):
    """Lista todas as perdas registradas da mais recente para a mais antiga."""
    linhas = db.execute(
        select(Movimentacao, Produto.nome, Produto.unidade_base)
        .join(Produto, Produto.id == Movimentacao.produto_id)
        .where(Movimentacao.tipo == "perda")
        .order_by(Movimentacao.criado_em.desc())
    ).all()

    resultado = []
    for mov, nome_produto, unidade in linhas:
        custo_total = (Decimal(mov.quantidade) * Decimal(mov.custo_unitario)).quantize(
            CENTAVOS, rounding=ROUND_HALF_UP
        )
        resultado.append(
            {
                "id": mov.id,
                "produto": nome_produto,
                "unidade": unidade,
                "quantidade": float(mov.quantidade),
                "motivo": mov.motivo,
                "custo_total": float(custo_total),
                "criado_em": mov.criado_em.isoformat(),
            }
        )
    return resultado
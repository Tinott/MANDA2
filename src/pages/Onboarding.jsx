import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Building2, Landmark, Percent, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Field, Input, Select, Button, Stepper } from '../components/ui';

const STEPS = ['Société', 'Fiscalité', 'Barème honoraires', 'Prêt'];

export default function Onboarding() {
  const { societe, completeOnboarding } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    nom: societe.nom, siret: societe.siret, adresse: societe.adresse,
    carteT: societe.carteT, rcp: societe.rcp, capitalSocial: societe.capitalSocial,
    regimeTva: societe.regimeTva, tauxTvaDefaut: societe.tauxTvaDefaut,
    contactNom: societe.contactNom, telephone: societe.telephone, email: societe.email,
    tauxBareme: 4,
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function finish() {
    completeOnboarding({
      ...form,
      capitalSocial: Number(form.capitalSocial) || 0,
      tauxTvaDefaut: Number(form.tauxTvaDefaut) || 20,
      bareme: {
        type: 'degressif',
        tranches: [
          { jusqu_a: 200000, taux: Number(form.tauxBareme) + 1 },
          { jusqu_a: 500000, taux: Number(form.tauxBareme) },
          { jusqu_a: null, taux: Math.max(1, Number(form.tauxBareme) - 1) },
        ],
      },
    });
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brass/60 text-brass font-display text-xl mb-4">
            M
          </span>
          <h1 className="font-display text-[26px] text-white">Bienvenue sur Mandat</h1>
          <p className="text-white/50 text-[13.5px] mt-1.5">
            Quelques informations pour configurer votre espace de gestion. Comptez deux minutes.
          </p>
        </div>

        <div className="bg-surface rounded-2xl border border-line p-7 shadow-2xl">
          <Stepper steps={STEPS} current={step} />

          {step === 0 && (
            <div className="space-y-4 animate-rise">
              <div className="flex items-center gap-2 text-ink-soft text-[12.5px] mb-1">
                <Building2 size={14} /> Identité de la société
              </div>
              <Field label="Raison sociale" required>
                <Input value={form.nom} onChange={set('nom')} placeholder="Ex. Horizon Immobilier SARL" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="SIRET" required>
                  <Input value={form.siret} onChange={set('siret')} placeholder="14 chiffres" />
                </Field>
                <Field label="Carte T (transaction)" hint="Optionnel">
                  <Input value={form.carteT} onChange={set('carteT')} />
                </Field>
              </div>
              <Field label="Adresse du siège">
                <Input value={form.adresse} onChange={set('adresse')} placeholder="Numéro, rue, code postal, ville" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nom du gérant">
                  <Input value={form.contactNom} onChange={set('contactNom')} />
                </Field>
                <Field label="Email professionnel">
                  <Input type="email" value={form.email} onChange={set('email')} />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-rise">
              <div className="flex items-center gap-2 text-ink-soft text-[12.5px] mb-1">
                <Landmark size={14} /> Régime fiscal
              </div>
              <Field label="Régime de TVA" required>
                <Select value={form.regimeTva} onChange={set('regimeTva')}>
                  <option value="reel_normal">Réel normal</option>
                  <option value="reel_simplifie">Réel simplifié</option>
                  <option value="franchise">Franchise en base (sans TVA)</option>
                </Select>
              </Field>
              <Field label="Taux de TVA par défaut" hint="Appliqué aux factures d'honoraires — modifiable ligne par ligne">
                <Select value={form.tauxTvaDefaut} onChange={set('tauxTvaDefaut')}>
                  <option value={20}>20 % — taux normal</option>
                  <option value={10}>10 % — taux intermédiaire</option>
                  <option value={0}>0 % — franchise en base</option>
                </Select>
              </Field>
              <Field label="Capital social" required>
                <Input type="number" value={form.capitalSocial} onChange={set('capitalSocial')} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-rise">
              <div className="flex items-center gap-2 text-ink-soft text-[12.5px] mb-1">
                <Percent size={14} /> Barème d'honoraires par défaut
              </div>
              <p className="text-[12.5px] text-ink-soft -mt-1 mb-2">
                Utilisé pour pré-calculer vos honoraires à partir d'un prix de vente. Vous pourrez créer
                d'autres barèmes (forfait, taux fixe) et les affiner dans les Paramètres.
              </p>
              <Field label="Taux moyen appliqué" hint="Un barème dégressif par tranches sera généré autour de ce taux — ajustable ensuite">
                <Select value={form.tauxBareme} onChange={set('tauxBareme')}>
                  {[3, 4, 5, 6, 7].map((t) => (
                    <option key={t} value={t}>{t} %</option>
                  ))}
                </Select>
              </Field>
              <div className="rounded-lg border border-line bg-paper-raised p-4 text-[12.5px] text-ink-soft">
                Aperçu : {Number(form.tauxBareme) + 1}% jusqu'à 200 000 € · {form.tauxBareme}% de 200 000 à 500 000 € · {Math.max(1, Number(form.tauxBareme) - 1)}% au-delà.
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-6 animate-rise">
              <CheckCircle2 className="mx-auto text-teal mb-3" size={34} strokeWidth={1.5} />
              <div className="font-display text-[20px] text-ink">Votre espace est prêt</div>
              <p className="text-ink-soft text-[13.5px] mt-2 max-w-sm mx-auto">
                Vous partez d'un espace vide — c'est normal. Le tableau de bord vous guidera vers vos
                premières actions : créer un mandat, émettre une facture, ou enregistrer une note de frais.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-5 border-t border-line">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft size={15} /> Précédent
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                disabled={step === 0 && (!form.nom || !form.siret)}
              >
                Continuer <ArrowRight size={15} />
              </Button>
            ) : (
              <Button variant="brass" onClick={finish}>
                Entrer dans Mandat <ArrowRight size={15} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { supabase } from '../supabaseClient'

export async function listPatientIdsForTopic(topicId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('academy_topic_patients')
    .select('patient_id')
    .eq('topic_id', topicId)
  if (error) throw error
  return (data as Array<{ patient_id: string }>).map((r) => r.patient_id)
}

export async function listTopicIdsForPatient(patientId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('academy_topic_patients')
    .select('topic_id')
    .eq('patient_id', patientId)
  if (error) throw error
  return (data as Array<{ topic_id: string }>).map((r) => r.topic_id)
}

export async function linkTopicPatient(topicId: string, patientId: string, notes: string | null = null): Promise<void> {
  const { error } = await supabase
    .from('academy_topic_patients')
    .upsert({ topic_id: topicId, patient_id: patientId, notes }, { onConflict: 'topic_id,patient_id' })
  if (error) throw error
}

export async function unlinkTopicPatient(topicId: string, patientId: string): Promise<void> {
  const { error } = await supabase
    .from('academy_topic_patients')
    .delete()
    .eq('topic_id', topicId)
    .eq('patient_id', patientId)
  if (error) throw error
}
